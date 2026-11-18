package me.one_org.melody.Services.Api;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;

import me.one_org.melody.Entity.User;
import me.one_org.melody.Entity.UserGenrePreference;
import me.one_org.melody.Repository.UserGenrePreferenceRepository;
import me.one_org.melody.Repository.UsersRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserGenrePreferenceServiceTest {

    @Mock private UserGenrePreferenceRepository repo;
    @Mock private UsersRepository usersRepository;
    @Mock private PlatformTransactionManager txManager;

    private UserGenrePreferenceService service;
    private final User user = User.builder().id("u1").userName("u").build();

    @BeforeEach
    void setUp() {
        lenient().when(txManager.getTransaction(any())).thenReturn(mock(TransactionStatus.class));
        service = new UserGenrePreferenceService(repo, usersRepository, txManager);
    }

    @Test
    @DisplayName("normalize trims, strips commas, de-duplicates case-insensitively and caps at MAX_GENRES")
    void shouldNormalizeGenres() {
        assertThat(UserGenrePreferenceService.normalize(List.of(" Pop ", "pop", "Hip,Hop", "  ", "Rock")))
                .containsExactly("Pop", "Hip Hop", "Rock");

        List<String> many = java.util.stream.IntStream.range(0, 30).mapToObj(i -> "G" + i).toList();
        assertThat(UserGenrePreferenceService.normalize(many)).hasSize(UserGenrePreferenceService.MAX_GENRES);
        assertThat(UserGenrePreferenceService.normalize(null)).isEmpty();
    }

    @Test
    @DisplayName("savePreferences creates a row with normalized, comma-joined genres")
    void shouldSaveNewPreferences() {
        when(usersRepository.findById("u1")).thenReturn(Optional.of(user));
        when(repo.findByUser(user)).thenReturn(Optional.empty());

        service.savePreferences("u1", List.of("Rock", "rock", "Jazz"));

        ArgumentCaptor<UserGenrePreference> captor = ArgumentCaptor.forClass(UserGenrePreference.class);
        verify(repo).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getGenres()).isEqualTo("Rock,Jazz");
        assertThat(captor.getValue().getUser()).isSameAs(user);
    }

    @Test
    @DisplayName("savePreferences retries as an update when a concurrent insert wins the race")
    void shouldRetryOnConcurrentInsert() {
        UserGenrePreference existing = new UserGenrePreference();
        existing.setId("p1");
        existing.setUser(user);
        existing.setGenres("Pop");
        when(usersRepository.findById("u1")).thenReturn(Optional.of(user));
        when(repo.findByUser(user)).thenReturn(Optional.empty(), Optional.of(existing));
        when(repo.saveAndFlush(any()))
                .thenThrow(new DataIntegrityViolationException("duplicate user_id"))
                .thenReturn(existing);

        service.savePreferences("u1", List.of("Rock"));

        verify(repo, times(2)).saveAndFlush(any());
        assertThat(existing.getGenres()).isEqualTo("Rock");
    }

    @Test
    @DisplayName("savePreferences rejects a list with no usable genres")
    void shouldRejectEmptyGenres() {
        assertThatThrownBy(() -> service.savePreferences("u1", List.of(" ", ",")))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(repo);
    }

    @Test
    @DisplayName("getPreferences(User) parses stored genres with a single repository query")
    void shouldGetPreferencesForUser() {
        UserGenrePreference pref = new UserGenrePreference();
        pref.setGenres("Rock, Jazz ,");
        when(repo.findByUser(user)).thenReturn(Optional.of(pref));

        assertThat(service.getPreferences(user)).containsExactly("Rock", "Jazz");
        verifyNoInteractions(usersRepository);
    }
}

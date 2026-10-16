package me.one_org.melody.Services.Api;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.web.server.ResponseStatusException;

import me.one_org.melody.Entity.Song;
import me.one_org.melody.Entity.User;
import me.one_org.melody.Entity.UserHistory;
import me.one_org.melody.Events.TelemetryEvents;
import me.one_org.melody.Recommendation.Recombee;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Repository.UserHistoryRepository;
import me.one_org.melody.Repository.UsersRepository;
import me.one_org.melody.Services.General.PaginationMetaDataService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InteractionApiServiceTest {

    @Mock
    private Recombee recombee;

    @Mock
    private UsersRepository usersRepository;

    @Mock
    private SongsRepository songsRepository;

    @Mock
    private UserHistoryRepository userHistoryRepository;

    @Mock
    private PaginationMetaDataService paginationMetaDataService;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private InteractionApiService interactionApiService;

    @Test
    @DisplayName("Should save user history and emit SongPlayEvent")
    void shouldTrackPlaySuccessfully() {
        when(songsRepository.existsById("song-1")).thenReturn(true);
        when(usersRepository.existsById("user-1")).thenReturn(true);
        when(songsRepository.getReferenceById("song-1")).thenReturn(Song.builder().id("song-1").build());
        when(usersRepository.getReferenceById("user-1")).thenReturn(User.builder().id("user-1").build());

        interactionApiService.trackPlay("user-1", "song-1", 0.95);

        verify(userHistoryRepository).save(any(UserHistory.class));
        verify(paginationMetaDataService).incrementStatus("UserHistory_user-1", null);

        ArgumentCaptor<Object> eventCaptor = ArgumentCaptor.forClass(Object.class);
        verify(eventPublisher).publishEvent(eventCaptor.capture());

        assertThat(eventCaptor.getValue()).isInstanceOf(TelemetryEvents.SongPlayEvent.class);
        TelemetryEvents.SongPlayEvent event = (TelemetryEvents.SongPlayEvent) eventCaptor.getValue();
        assertThat(event.userId()).isEqualTo("user-1");
        assertThat(event.songId()).isEqualTo("song-1");
        assertThat(event.percentage()).isEqualTo(0.95);
    }

    @Test
    @DisplayName("Should throw NOT_FOUND if song does not exist")
    void shouldThrowWhenSongNotFound() {
        when(songsRepository.existsById("non-existent")).thenReturn(false);

        assertThatThrownBy(() -> interactionApiService.trackPlay("user-1", "non-existent", 0.5))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Song not found");

        verifyNoInteractions(userHistoryRepository);
        verifyNoInteractions(eventPublisher);
    }

    @Test
    @DisplayName("Should track search play in Recombee")
    void shouldTrackSearchPlay() throws Exception {
        interactionApiService.trackSearchPlay("user-1", "song-45");

        verify(recombee).trackSearchPlay("user-1", "song-45");
    }

    @Test
    @DisplayName("Should track skip in Recombee")
    void shouldTrackSkip() throws Exception {
        interactionApiService.trackSkip("user-1", "song-45");

        verify(recombee).trackSkip("user-1", "song-45");
    }
}

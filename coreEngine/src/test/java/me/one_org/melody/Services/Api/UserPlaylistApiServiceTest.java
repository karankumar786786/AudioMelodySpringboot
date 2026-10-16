package me.one_org.melody.Services.Api;

import java.util.ArrayList;
import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.web.server.ResponseStatusException;

import me.one_org.melody.Entity.User;
import me.one_org.melody.Entity.UserPlaylist;
import me.one_org.melody.Enums.PlaylistPrivacyEnum;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Repository.UserPlaylistsRepository;
import me.one_org.melody.Repository.UserSavedPlaylistsRepository;
import me.one_org.melody.Repository.UserSearchHistoryRepository;
import me.one_org.melody.Repository.UsersRepository;
import me.one_org.melody.Services.General.PaginationMetaDataService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserPlaylistApiServiceTest {

    @Mock
    private UserPlaylistsRepository userPlaylistsRepository;
    @Mock
    private UserSavedPlaylistsRepository userSavedPlaylistsRepository;
    @Mock
    private UserSearchHistoryRepository userSearchHistoryRepository;
    @Mock
    private SongsRepository songsRepository;
    @Mock
    private UsersRepository usersRepository;
    @Mock
    private PaginationMetaDataService paginationMetaDataService;
    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private UserPlaylistApiService userPlaylistApiService;

    @Test
    @DisplayName("createPlaylist should save new playlist with share token and increment metadata")
    void createPlaylist() {
        User user = User.builder().id("u-1").userName("alice").build();
        when(usersRepository.getReferenceById("u-1")).thenReturn(user);

        UserPlaylist created = userPlaylistApiService.createPlaylist("u-1", "My Chill Vibes", PlaylistPrivacyEnum.PUBLIC);

        assertThat(created.getName()).isEqualTo("My Chill Vibes");
        assertThat(created.getPrivacy()).isEqualTo(PlaylistPrivacyEnum.PUBLIC);
        assertThat(created.getShareToken()).isNotBlank();
        verify(userPlaylistsRepository).save(any(UserPlaylist.class));
        verify(paginationMetaDataService).incrementStatus(eq("UserPlaylists_u-1"), isNull());
        verify(eventPublisher).publishEvent(any());
    }

    @Test
    @DisplayName("renamePlaylist should fail if user is not the owner")
    void renamePlaylistForbidden() {
        User owner = User.builder().id("owner-1").build();
        UserPlaylist playlist = UserPlaylist.builder().id("pl-1").user(owner).name("Old").build();

        when(userPlaylistsRepository.findById("pl-1")).thenReturn(Optional.of(playlist));

        assertThatThrownBy(() -> userPlaylistApiService.renamePlaylist("stranger-2", "pl-1", "Hacked"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Not your playlist");
    }

    @Test
    @DisplayName("addSong should append song and increment totalSongs")
    void addSong() {
        User user = User.builder().id("u-1").build();
        UserPlaylist playlist = UserPlaylist.builder()
                .id("pl-1")
                .user(user)
                .totalSongs(0)
                .songs(new ArrayList<>())
                .build();

        when(userPlaylistsRepository.findById("pl-1")).thenReturn(Optional.of(playlist));
        when(songsRepository.existsById("song-99")).thenReturn(true);
        when(userPlaylistsRepository.addSongToPlaylist("pl-1", "song-99")).thenReturn(true);

        UserPlaylist updated = userPlaylistApiService.addSong("u-1", "pl-1", "song-99");

        assertThat(updated.getTotalSongs()).isEqualTo(1);
        verify(userPlaylistsRepository).addSongToPlaylist("pl-1", "song-99");
        verify(paginationMetaDataService).incrementStatus("UserPlaylistSongs_pl-1", null);
    }

    @Test
    @DisplayName("removeSong should remove song and decrement totalSongs")
    void removeSong() {
        User user = User.builder().id("u-1").build();
        UserPlaylist playlist = UserPlaylist.builder()
                .id("pl-1")
                .user(user)
                .totalSongs(1)
                .songs(new ArrayList<>())
                .build();

        when(userPlaylistsRepository.findById("pl-1")).thenReturn(Optional.of(playlist));
        when(userPlaylistsRepository.removeSongFromPlaylist("pl-1", "song-99")).thenReturn(true);

        UserPlaylist updated = userPlaylistApiService.removeSong("u-1", "pl-1", "song-99");

        assertThat(updated.getTotalSongs()).isEqualTo(0);
        verify(userPlaylistsRepository).removeSongFromPlaylist("pl-1", "song-99");
        verify(paginationMetaDataService).decrementStatus("UserPlaylistSongs_pl-1", null);
    }
}

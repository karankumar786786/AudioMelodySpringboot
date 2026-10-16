package me.one_org.melody.Services.Api;

import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import me.one_org.melody.Entity.Playlist;
import me.one_org.melody.Exceptions.ResourceNotFoundException;
import me.one_org.melody.Repository.PlaylistsRepository;
import me.one_org.melody.Services.General.PaginationMetaDataService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PlaylistApiServiceTest {

    @Mock
    private PlaylistsRepository playlistsRepository;

    @Mock
    private PaginationMetaDataService paginationMetaDataService;

    @InjectMocks
    private PlaylistApiService playlistApiService;

    @Test
    @DisplayName("getPlaylistsPaginated should return empty list on out-of-bounds or invalid params")
    void getPlaylistsPaginatedOutOfBounds() {
        assertThat(playlistApiService.getPlaylistsPaginated(-1, 10)).isEmpty();
        assertThat(playlistApiService.getPlaylistsPaginated(0, 0)).isEmpty();

        when(paginationMetaDataService.getMetaData("PlaylistsEntity")).thenReturn(null);
        when(playlistsRepository.findAllPaginated(0, 10)).thenReturn(java.util.List.of());
        assertThat(playlistApiService.getPlaylistsPaginated(0, 10)).isEmpty();
    }

    @Test
    @DisplayName("getPlaylistById should return playlist or throw ResourceNotFoundException")
    void getPlaylistById() {
        Playlist playlist = Playlist.builder().id("pl-1").name("Today's Hits").build();
        when(playlistsRepository.findById("pl-1")).thenReturn(Optional.of(playlist));
        when(playlistsRepository.findById("pl-none")).thenReturn(Optional.empty());

        assertThat(playlistApiService.getPlaylistById("pl-1").name()).isEqualTo("Today's Hits");
        assertThatThrownBy(() -> playlistApiService.getPlaylistById("pl-none"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Playlist not found with id: pl-none");
    }
}

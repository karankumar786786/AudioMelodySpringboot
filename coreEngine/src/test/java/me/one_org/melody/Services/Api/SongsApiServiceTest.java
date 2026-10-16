package me.one_org.melody.Services.Api;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import me.one_org.melody.Dto.Controllers.AlbumDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Entity.PaginationMetaData;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Exceptions.ResourceNotFoundException;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Services.General.PaginationMetaDataService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SongsApiServiceTest {

    @Mock
    private SongsRepository songsRepository;

    @Mock
    private PaginationMetaDataService paginationMetaDataService;

    @InjectMocks
    private SongsApiService songsApiService;

    @Test
    @DisplayName("browseSongs should return empty list on out-of-bounds page or invalid size")
    void browseSongsOutOfBounds() {
        assertThat(songsApiService.browseSongs(0, 0)).isEmpty();
        assertThat(songsApiService.browseSongs(-1, 10)).isEmpty();

        PaginationMetaData meta = PaginationMetaData.builder().totalCount(10L).build();
        when(paginationMetaDataService.getMetaData("SongsEntity")).thenReturn(meta);

        assertThat(songsApiService.browseSongs(2, 10)).isEmpty();
    }

    @Test
    @DisplayName("browseSongs should return songs when within bounds")
    void browseSongsValid() {
        PaginationMetaData meta = PaginationMetaData.builder().totalCount(50L).build();
        when(paginationMetaDataService.getMetaData("SongsEntity")).thenReturn(meta);

        Song song = Song.builder().id("s-1").title("Track 1").build();
        when(songsRepository.findAllPaginated(0, 10)).thenReturn(List.of(song));

        List<SongDto> result = songsApiService.browseSongs(0, 10);
        assertThat(result).hasSize(1);
        assertThat(result.get(0).title()).isEqualTo("Track 1");
    }

    @Test
    @DisplayName("getSongById should return song or throw ResourceNotFoundException")
    void getSongById() {
        Song song = Song.builder().id("s-100").title("Found").build();
        when(songsRepository.findById("s-100")).thenReturn(Optional.of(song));
        when(songsRepository.findById("s-unknown")).thenReturn(Optional.empty());

        assertThat(songsApiService.getSongById("s-100").title()).isEqualTo("Found");
        assertThatThrownBy(() -> songsApiService.getSongById("s-unknown"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Song not found with id: s-unknown");
    }

    @Test
    @DisplayName("getAllAlbums should map object array to AlbumDto list")
    void getAllAlbums() {
        java.util.List<Object[]> rows = new java.util.ArrayList<>();
        rows.add(new Object[]{"Album X", "Artist Y", 12L, "img-key", "Rock"});
        when(songsRepository.findDistinctAlbums()).thenReturn(rows);

        List<AlbumDto> albums = songsApiService.getAllAlbums();
        assertThat(albums).hasSize(1);
        assertThat(albums.get(0).name()).isEqualTo("Album X");
        assertThat(albums.get(0).artistName()).isEqualTo("Artist Y");
        assertThat(albums.get(0).trackCount()).isEqualTo(12L);
        assertThat(albums.get(0).genre()).isEqualTo("Rock");
    }
}

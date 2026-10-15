package me.one_org.melody.Services.Api;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import me.one_org.melody.AlgoliaSearch.AlgoliaSearch;
import me.one_org.melody.Dto.AlgoliaSearch.AlgoliaClientConfigDto;
import me.one_org.melody.Dto.AlgoliaSearch.AlgoliaSearchResult;
import me.one_org.melody.Dto.AlgoliaSearch.AlgoliaSearchSongDto;
import me.one_org.melody.Dto.AlgoliaSearch.SearchResult;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Entity.SongMetadata;
import me.one_org.melody.Repository.ArtistsRepository;
import me.one_org.melody.Repository.PlaylistsRepository;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Repository.UserPlaylistsRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SearchApiServiceTest {

    @Mock
    private AlgoliaSearch algoliaSearch;

    @Mock
    private SongsRepository songsRepository;

    @Mock
    private ArtistsRepository artistsRepository;

    @Mock
    private PlaylistsRepository playlistsRepository;

    @Mock
    private UserPlaylistsRepository userPlaylistsRepository;

    @InjectMocks
    private SearchApiService searchApiService;

    @Test
    @DisplayName("Should query Algolia and preserve ranking order with totalStreams")
    void shouldPreserveAlgoliaRankingOrder() {
        // Algolia returns song-2 first (higher streams), then song-1
        AlgoliaSearchResult algoliaResult = new AlgoliaSearchResult(
                List.of(new AlgoliaSearchSongDto("song-2"), new AlgoliaSearchSongDto("song-1")),
                List.of(),
                List.of()
        );
        when(algoliaSearch.search("rock")).thenReturn(algoliaResult);

        Song song1 = Song.builder()
                .id("song-1")
                .title("Song One")
                .artistName("Artist A")
                .songMetadata(SongMetadata.builder().totalStreams(100L).build())
                .build();

        Song song2 = Song.builder()
                .id("song-2")
                .title("Song Two")
                .artistName("Artist B")
                .songMetadata(SongMetadata.builder().totalStreams(5000L).build())
                .build();

        // Database might return in any order
        when(songsRepository.findAllByIds(List.of("song-2", "song-1"))).thenReturn(List.of(song1, song2));
        when(artistsRepository.findAllByIds(anyList())).thenReturn(List.of());
        when(playlistsRepository.findAllByIds(anyList())).thenReturn(List.of());
        when(userPlaylistsRepository.findAllPublicByIds(anyList())).thenReturn(List.of());

        SearchResult result = searchApiService.search("rock", "user-123");

        assertThat(result.songs()).hasSize(2);
        // Verify preserved order: song-2 must come first!
        assertThat(result.songs().get(0).id()).isEqualTo("song-2");
        assertThat(result.songs().get(0).totalStreams()).isEqualTo(5000L);
        assertThat(result.songs().get(1).id()).isEqualTo("song-1");
        assertThat(result.songs().get(1).totalStreams()).isEqualTo(100L);
    }

    @Test
    @DisplayName("Should return frontend search configuration")
    void shouldReturnFrontendConfig() {
        AlgoliaClientConfigDto config = new AlgoliaClientConfigDto("app-1", "idx-1", "key-1");
        when(algoliaSearch.getClientSearchConfig()).thenReturn(config);

        AlgoliaClientConfigDto res = searchApiService.getFrontendSearchConfig();

        assertThat(res.appId()).isEqualTo("app-1");
        assertThat(res.indexName()).isEqualTo("idx-1");
        assertThat(res.apiKey()).isEqualTo("key-1");
    }
}

package me.one_org.melody.Services.Api;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import me.one_org.melody.AlgoliaSearch.AlgoliaSearch;
import me.one_org.melody.Dto.AlgoliaSearch.SearchResult;
import me.one_org.melody.Dto.Controllers.Api.SongDto;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SearchApiServiceTest {

    @Mock
    private AlgoliaSearch algoliaSearch;

    @InjectMocks
    private SearchApiService searchApiService;

    @Test
    @DisplayName("Should query Algolia detailed and return ranked results with zero DB lookups")
    void shouldReturnAlgoliaDetailedResults() {
        SongDto s1 = new SongDto("song-2", "Song Two", "Artist B", 200, "key2", "img2", null, null, null, null, false, "English", "Rock", "Album", "lrc", null, 5000L, null);
        SongDto s2 = new SongDto("song-1", "Song One", "Artist A", 180, "key1", "img1", null, null, null, null, false, "English", "Pop", "Album", "lrc", null, 100L, null);
        SearchResult searchResult = new SearchResult(List.of(s1, s2), List.of(), List.of(), List.of());

        when(algoliaSearch.searchDetailed("rock")).thenReturn(searchResult);

        SearchResult result = searchApiService.search("rock", "user-123");

        assertThat(result.songs()).hasSize(2);
        assertThat(result.songs().get(0).id()).isEqualTo("song-2");
        assertThat(result.songs().get(0).totalStreams()).isEqualTo(5000L);
        assertThat(result.songs().get(1).id()).isEqualTo("song-1");
        assertThat(result.songs().get(1).totalStreams()).isEqualTo(100L);
        verify(algoliaSearch).searchDetailed("rock");
    }
}

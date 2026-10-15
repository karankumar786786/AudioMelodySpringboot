package me.one_org.melody.Integration;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import me.one_org.melody.Controllers.Api.AlgoliaApiController;
import me.one_org.melody.Dto.AlgoliaSearch.AlgoliaClientConfigDto;
import me.one_org.melody.Dto.AlgoliaSearch.SearchResult;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Services.Api.SearchApiService;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AlgoliaApiController.class)
@AutoConfigureMockMvc(addFilters = false)
class AlgoliaApiControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private SearchApiService searchApiService;

    @Test
    @DisplayName("GET /api/search/config should return 200 OK and Algolia credentials")
    void shouldReturnAlgoliaSearchConfig() throws Exception {
        when(searchApiService.getFrontendSearchConfig())
                .thenReturn(new AlgoliaClientConfigDto("test-app", "melody-songs", "sec-key-123"));

        mockMvc.perform(get("/api/search/config")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.appId").value("test-app"))
                .andExpect(jsonPath("$.indexName").value("melody-songs"))
                .andExpect(jsonPath("$.searchApiKey").value("sec-key-123"));
    }

    @Test
    @DisplayName("GET /api/search?q=rock should return 200 OK and ranked SearchResult with totalStreams")
    void shouldReturnSearchResults() throws Exception {
        SongDto songDto = new SongDto(
                "song-1", "Smells Like Teen Spirit", "Nirvana", 301,
                "song/key", "image/key", null, null, null, null,
                true, "English", "Grunge", "Nevermind", "lrc-1",
                null, 150000L, null
        );
        SearchResult searchResult = new SearchResult(List.of(songDto), List.of(), List.of(), List.of());

        when(searchApiService.search("rock", null)).thenReturn(searchResult);

        mockMvc.perform(get("/api/search")
                        .param("q", "rock")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.songs[0].id").value("song-1"))
                .andExpect(jsonPath("$.songs[0].title").value("Smells Like Teen Spirit"))
                .andExpect(jsonPath("$.songs[0].totalStreams").value(150000));
    }
}

package me.one_org.melody.Integration;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import me.one_org.melody.Controllers.Api.AlgoliaApiController;
import me.one_org.melody.Dto.AlgoliaSearch.SearchResult;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Services.Api.SearchApiService;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class AlgoliaApiControllerIntegrationTest {

    private MockMvc mockMvc;

    @Mock
    private SearchApiService searchApiService;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new AlgoliaApiController(searchApiService))
                .setCustomArgumentResolvers(new me.one_org.melody.Utils.CurrentUserTestArgumentResolver())
                .build();
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

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

import me.one_org.melody.Controllers.Api.RecombeeApiController;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Services.Api.RecommendationApiService;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class RecombeeApiControllerIntegrationTest {

    private MockMvc mockMvc;

    @Mock
    private RecommendationApiService recommendationApiService;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new RecombeeApiController(recommendationApiService))
                .setCustomArgumentResolvers(new me.one_org.melody.Utils.CurrentUserTestArgumentResolver())
                .build();
    }



    @Test
    @DisplayName("GET /api/recommendations/similar/{songId} should return similar songs")
    void shouldRecommendSimilar() throws Exception {
        SongDto song = new SongDto("s-sim-2", "Similar Song", "Artist Y", 200, "key", "img", null, null, null, null, false, "English", "Rock", "Album", "lrc", null, 2500L, null);
        when(recommendationApiService.recommendSimilar("s-seed", 5)).thenReturn(List.of(song));

        mockMvc.perform(get("/api/recommendations/similar/s-seed")
                        .param("count", "5")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("s-sim-2"));
    }

    @Test
    @DisplayName("GET /api/recommendations/radio should parse seed and excludeIds")
    void shouldRecommendRadio() throws Exception {
        SongDto song = new SongDto("s-rad-3", "Radio Song", "Artist Z", 220, "key", "img", null, null, null, null, false, "English", "Indie", "Album", "lrc", null, 5000L, null);
        when(recommendationApiService.recommendRadio("seed-1", List.of("ex-1", "ex-2"), 10)).thenReturn(List.of(song));

        mockMvc.perform(get("/api/recommendations/radio")
                        .param("seedSongId", "seed-1")
                        .param("excludeIds", "ex-1,ex-2")
                        .param("count", "10")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("s-rad-3"));
    }
}

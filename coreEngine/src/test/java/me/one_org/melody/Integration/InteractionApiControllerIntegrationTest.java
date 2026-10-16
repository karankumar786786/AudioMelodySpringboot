package me.one_org.melody.Integration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import me.one_org.melody.Controllers.Api.InteractionApiController;
import me.one_org.melody.Services.Api.InteractionApiService;

import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class InteractionApiControllerIntegrationTest {

    private MockMvc mockMvc;

    @Mock
    private InteractionApiService interactionApiService;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new InteractionApiController(interactionApiService)).build();
    }

    @Test
    @DisplayName("POST /api/interaction/play should record play telemetry and return 200 OK")
    void shouldTrackPlay() throws Exception {
        mockMvc.perform(post("/api/interaction/play")
                        .requestAttr("userId", "u-101")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"songId\":\"song-1\",\"percentage\":0.85}"))
                .andExpect(status().isOk());

        verify(interactionApiService).trackPlay("u-101", "song-1", 0.85);
    }

    @Test
    @DisplayName("POST /api/interaction/skip should record skip and return 200 OK")
    void shouldTrackSkip() throws Exception {
        mockMvc.perform(post("/api/interaction/skip")
                        .requestAttr("userId", "u-101")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"songId\":\"song-2\"}"))
                .andExpect(status().isOk());

        verify(interactionApiService).trackSkip("u-101", "song-2");
    }

    @Test
    @DisplayName("POST /api/interaction/favourite/{songId} should add favourite and return 200 OK")
    void shouldAddFavourite() throws Exception {
        mockMvc.perform(post("/api/interaction/favourite/song-3")
                        .requestAttr("userId", "u-101")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());

        verify(interactionApiService).addFavourite("u-101", "song-3");
    }

    @Test
    @DisplayName("DELETE /api/interaction/favourite/{songId} should remove favourite and return 200 OK")
    void shouldRemoveFavourite() throws Exception {
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/interaction/favourite/song-3")
                        .requestAttr("userId", "u-101")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isNoContent());

        verify(interactionApiService).removeFavourite("u-101", "song-3");
    }
}

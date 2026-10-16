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

import me.one_org.melody.Controllers.Api.PlaylistApiController;
import me.one_org.melody.Entity.PaginationMetaData;
import me.one_org.melody.Entity.Playlist;
import me.one_org.melody.Services.Api.PlaylistApiService;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class PlaylistApiControllerIntegrationTest {

    private MockMvc mockMvc;

    @Mock
    private PlaylistApiService playlistApiService;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new PlaylistApiController(playlistApiService)).build();
    }

    @Test
    @DisplayName("GET /api/playlists should return paginated playlists")
    void shouldReturnPlaylists() throws Exception {
        Playlist playlist = Playlist.builder().id("pl-10").name("Top 50 Global").totalSongs(50).build();
        when(playlistApiService.getPlaylistsPaginated(0, 20)).thenReturn(List.of(playlist));
        when(playlistApiService.getPaginationMetaData()).thenReturn(PaginationMetaData.builder().totalCount(1L).build());

        mockMvc.perform(get("/api/playlists")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value("pl-10"))
                .andExpect(jsonPath("$.content[0].name").value("Top 50 Global"));
    }

    @Test
    @DisplayName("GET /api/playlists/{id} should return single playlist")
    void shouldReturnPlaylistById() throws Exception {
        Playlist playlist = Playlist.builder().id("pl-10").name("Top 50 Global").totalSongs(50).build();
        when(playlistApiService.getPlaylistById("pl-10")).thenReturn(playlist);

        mockMvc.perform(get("/api/playlists/pl-10")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("pl-10"))
                .andExpect(jsonPath("$.name").value("Top 50 Global"));
    }
}

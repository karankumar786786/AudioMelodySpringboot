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

import me.one_org.melody.Controllers.Api.UserPlaylistApiController;
import me.one_org.melody.Entity.User;
import me.one_org.melody.Entity.UserPlaylist;
import me.one_org.melody.Enums.PlaylistPrivacyEnum;
import me.one_org.melody.Services.Api.UserPlaylistApiService;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class UserPlaylistApiControllerIntegrationTest {

    private MockMvc mockMvc;

    @Mock
    private UserPlaylistApiService userPlaylistApiService;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new UserPlaylistApiController(userPlaylistApiService)).build();
    }

    @Test
    @DisplayName("POST /api/user/playlists should create playlist and return 201 Created")
    void shouldCreatePlaylist() throws Exception {
        User user = User.builder().id("u-1").userName("alice").build();
        UserPlaylist playlist = UserPlaylist.builder()
                .id("upl-1")
                .name("Morning Coffee")
                .privacy(PlaylistPrivacyEnum.PUBLIC)
                .user(user)
                .totalSongs(0)
                .build();

        when(userPlaylistApiService.createPlaylist(eq("u-1"), eq("Morning Coffee"), eq(PlaylistPrivacyEnum.PUBLIC)))
                .thenReturn(playlist);

        mockMvc.perform(post("/api/user/playlists")
                        .requestAttr("userId", "u-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Morning Coffee\",\"privacy\":\"PUBLIC\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("upl-1"))
                .andExpect(jsonPath("$.name").value("Morning Coffee"))
                .andExpect(jsonPath("$.privacy").value("PUBLIC"));
    }

    @Test
    @DisplayName("PUT /api/user/playlists/{id} should rename playlist and return 200 OK")
    void shouldRenamePlaylist() throws Exception {
        User user = User.builder().id("u-1").build();
        UserPlaylist playlist = UserPlaylist.builder()
                .id("upl-2")
                .name("Evening Chill")
                .user(user)
                .totalSongs(0)
                .build();

        when(userPlaylistApiService.renamePlaylist("u-1", "upl-2", "Evening Chill"))
                .thenReturn(playlist);

        mockMvc.perform(put("/api/user/playlists/upl-2")
                        .requestAttr("userId", "u-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Evening Chill\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Evening Chill"));
    }

    @Test
    @DisplayName("DELETE /api/user/playlists/{id} should delete playlist and return 204 No Content")
    void shouldDeletePlaylist() throws Exception {
        mockMvc.perform(delete("/api/user/playlists/upl-3")
                        .requestAttr("userId", "u-1"))
                .andExpect(status().isNoContent());

        verify(userPlaylistApiService).deletePlaylist("u-1", "upl-3");
    }

    @Test
    @DisplayName("POST /api/user/playlists/{id}/songs should add song and return 200 OK")
    void shouldAddSongToPlaylist() throws Exception {
        User user = User.builder().id("u-1").build();
        UserPlaylist playlist = UserPlaylist.builder()
                .id("upl-4")
                .name("Party Hits")
                .user(user)
                .totalSongs(1)
                .build();

        when(userPlaylistApiService.addSong("u-1", "upl-4", "s-123")).thenReturn(playlist);

        mockMvc.perform(post("/api/user/playlists/upl-4/songs")
                        .requestAttr("userId", "u-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"songId\":\"s-123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalSongs").value(1));
    }
}

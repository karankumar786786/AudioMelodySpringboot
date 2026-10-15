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

import me.one_org.melody.Controllers.Api.SongsApiController;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Entity.SongMetadata;
import me.one_org.melody.Enums.StatusEnum;
import me.one_org.melody.Services.Api.SongsApiService;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(SongsApiController.class)
@AutoConfigureMockMvc(addFilters = false)
class SongsApiControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private SongsApiService songsApiService;

    @Test
    @DisplayName("GET /api/songs/featured should return featured songs with totalStreams")
    void shouldReturnFeaturedSongs() throws Exception {
        Song song = Song.builder()
                .id("song-feat-1")
                .title("Featured Melody")
                .artistName("Star Singer")
                .duration(210)
                .songKey("s3/feat.mp3")
                .imageKey("s3/feat.jpg")
                .isFeatured(true)
                .language("English")
                .genre("Pop")
                .album("Top Hits")
                .lrclibId("lrc-f")
                .status(StatusEnum.ACTIVE)
                .songMetadata(SongMetadata.builder().totalStreams(88000L).build())
                .build();

        when(songsApiService.getFeaturedSongs()).thenReturn(List.of(song));

        mockMvc.perform(get("/api/songs/featured")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("song-feat-1"))
                .andExpect(jsonPath("$[0].title").value("Featured Melody"))
                .andExpect(jsonPath("$[0].totalStreams").value(88000));
    }

    @Test
    @DisplayName("GET /api/songs/{id} should return single song DTO")
    void shouldReturnSongById() throws Exception {
        Song song = Song.builder()
                .id("song-42")
                .title("Sweet Child O' Mine")
                .artistName("Guns N' Roses")
                .duration(356)
                .songKey("s3/guns.mp3")
                .imageKey("s3/guns.jpg")
                .isFeatured(false)
                .language("English")
                .genre("Rock")
                .album("Appetite for Destruction")
                .lrclibId("lrc-42")
                .status(StatusEnum.ACTIVE)
                .songMetadata(SongMetadata.builder().totalStreams(520000L).build())
                .build();

        when(songsApiService.getSongById("song-42")).thenReturn(song);

        mockMvc.perform(get("/api/songs/song-42")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("song-42"))
                .andExpect(jsonPath("$.artistName").value("Guns N' Roses"))
                .andExpect(jsonPath("$.totalStreams").value(520000));
    }
}

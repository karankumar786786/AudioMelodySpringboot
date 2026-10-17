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
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import me.one_org.melody.Controllers.Api.HomeApiController;
import me.one_org.melody.Dto.Controllers.Api.PaginationMetaDataDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Enums.StatusEnum;
import me.one_org.melody.Services.Api.ArtistApiService;
import me.one_org.melody.Services.Api.PlaylistApiService;
import me.one_org.melody.Services.Api.RecommendationApiService;
import me.one_org.melody.Services.Api.SongsApiService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.mockito.quality.Strictness;
import org.mockito.junit.jupiter.MockitoSettings;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class HomeApiControllerIntegrationTest {

    private MockMvc mockMvc;

    @Mock
    private SongsApiService songsApiService;

    @Mock
    private ArtistApiService artistApiService;

    @Mock
    private PlaylistApiService playlistApiService;

    @Mock
    private RecommendationApiService recommendationApiService;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new HomeApiController(
                songsApiService,
                artistApiService,
                playlistApiService,
                recommendationApiService
        )).build();
    }

    @Test
    @DisplayName("GET /api/home/stream should return text/event-stream with async emitter")
    void shouldStreamHomeFeed() throws Exception {
        Song song = Song.builder()
                .id("song-1")
                .title("Streamed Song")
                .artistName("Stream Artist")
                .duration(200)
                .songKey("s3/key.mp3")
                .imageKey("s3/cover.jpg")
                .isFeatured(true)
                .language("English")
                .genre("Acoustic")
                .album("Stream Album")
                .lrclibId("lrc-1")
                .status(StatusEnum.ACTIVE)
                .build();

        when(songsApiService.getFeaturedSongs()).thenReturn(List.of(SongDto.fromEntity(song)));
        when(songsApiService.getTrendingSongs(12)).thenReturn(List.of(SongDto.fromEntity(song)));
        when(songsApiService.browseSongs(0, 15)).thenReturn(List.of(SongDto.fromEntity(song)));
        when(songsApiService.getPaginationMetaData()).thenReturn(new PaginationMetaDataDto("meta-1", "SongsEntity", 1L, 1L, 0L, 0L, java.time.LocalDateTime.now()));

        MvcResult result = mockMvc.perform(get("/api/home/stream")
                        .accept(MediaType.TEXT_EVENT_STREAM_VALUE))
                .andExpect(status().isOk())
                .andExpect(request().asyncStarted())
                .andReturn();

        assertThat(result.getResponse().getContentType()).contains(MediaType.TEXT_EVENT_STREAM_VALUE);
    }
}

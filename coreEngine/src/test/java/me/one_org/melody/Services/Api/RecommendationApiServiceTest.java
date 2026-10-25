package me.one_org.melody.Services.Api;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Recommendation.Recombee;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RecommendationApiServiceTest {

    @Mock
    private Recombee recombee;

    @InjectMocks
    private RecommendationApiService recommendationApiService;

    @Test
    @DisplayName("Should return radio recommendations directly from Recombee")
    void shouldRecommendRadioDetailed() throws Exception {
        SongDto s1 = new SongDto("song-1", "Song One", "Artist A", 180, "key1", "img1", null, null, null, null, false, "English", "Pop", "Album", "lrc", null, 120L, null);
        SongDto s2 = new SongDto("song-2", "Song Two", "Artist B", 200, "key2", "img2", null, null, null, null, false, "English", "Rock", "Album", "lrc", null, 340L, null);

        when(recombee.recommendRadioDetailed("seed-1", List.of("ex-1"), 5)).thenReturn(List.of(s1, s2));

        List<SongDto> dtos = recommendationApiService.recommendRadio("seed-1", List.of("ex-1"), 5);

        assertThat(dtos).hasSize(2);
        assertThat(dtos.get(0).id()).isEqualTo("song-1");
        assertThat(dtos.get(1).id()).isEqualTo("song-2");
        verify(recombee).recommendRadioDetailed("seed-1", List.of("ex-1"), 5);
    }

    @Test
    @DisplayName("Should return similar recommendations directly from Recombee")
    void shouldRecommendSimilarDetailed() throws Exception {
        SongDto s1 = new SongDto("song-1", "Song One", "Artist A", 180, "key1", "img1", null, null, null, null, false, "English", "Pop", "Album", "lrc", null, 120L, null);

        when(recombee.recommendSimilarDetailed("song-seed", 5)).thenReturn(List.of(s1));

        List<SongDto> dtos = recommendationApiService.recommendSimilar("song-seed", 5);

        assertThat(dtos).hasSize(1);
        assertThat(dtos.get(0).id()).isEqualTo("song-1");
        verify(recombee).recommendSimilarDetailed("song-seed", 5);
    }

    @Test
    @DisplayName("Should return empty list gracefully when Recombee fails")
    void shouldHandleRecombeeFailureGracefully() throws Exception {
        when(recombee.recommendRadioDetailed("seed-1", List.of(), 5)).thenThrow(new RuntimeException("Connection timeout"));

        List<SongDto> dtos = recommendationApiService.recommendRadio("seed-1", List.of(), 5);

        assertThat(dtos).isEmpty();
    }
}

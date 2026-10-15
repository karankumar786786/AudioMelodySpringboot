package me.one_org.melody.Services.Api;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Entity.SongMetadata;
import me.one_org.melody.Recommendation.Recombee;
import me.one_org.melody.Repository.SongsRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RecommendationApiServiceTest {

    @Mock
    private Recombee recombee;

    @Mock
    private SongsRepository songsRepository;

    @InjectMocks
    private RecommendationApiService recommendationApiService;

    @Test
    @DisplayName("Should return recommended songs for user")
    void shouldRecommendForUser() throws Exception {
        when(recombee.recommendForUser("user-1", 5)).thenReturn(List.of("song-1", "song-2"));

        Song s1 = Song.builder()
                .id("song-1")
                .title("Song One")
                .artistName("Artist A")
                .songMetadata(SongMetadata.builder().totalStreams(120L).build())
                .build();
        Song s2 = Song.builder()
                .id("song-2")
                .title("Song Two")
                .artistName("Artist B")
                .songMetadata(SongMetadata.builder().totalStreams(340L).build())
                .build();

        when(songsRepository.findAllByIds(List.of("song-1", "song-2"))).thenReturn(List.of(s1, s2));

        List<SongDto> dtos = recommendationApiService.recommendForUser("user-1", 5);

        assertThat(dtos).hasSize(2);
        assertThat(dtos.get(0).id()).isEqualTo("song-1");
        assertThat(dtos.get(1).id()).isEqualTo("song-2");
    }

    @Test
    @DisplayName("Should return empty list gracefully when Recombee fails")
    void shouldHandleRecombeeFailureGracefully() throws Exception {
        when(recombee.recommendForUser("user-1", 5)).thenThrow(new RuntimeException("Connection timeout"));

        List<SongDto> dtos = recommendationApiService.recommendForUser("user-1", 5);

        assertThat(dtos).isEmpty();
        verifyNoInteractions(songsRepository);
    }
}

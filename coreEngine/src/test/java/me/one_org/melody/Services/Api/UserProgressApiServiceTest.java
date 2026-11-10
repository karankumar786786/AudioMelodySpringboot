package me.one_org.melody.Services.Api;

import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;


import me.one_org.melody.Dto.Controllers.Api.UpdateProgressRequestDto;
import me.one_org.melody.Dto.Controllers.Api.UserProgressDto;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Repository.SongsRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserProgressApiServiceTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private SongsRepository songsRepository;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @InjectMocks
    private UserProgressApiService progressApiService;

    @Test
    @DisplayName("saveProgress should compute percentage and save to Redis")
    void saveProgress() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);

        UpdateProgressRequestDto request = new UpdateProgressRequestDto(
                "song-100",
                60.0,
                240.0,
                "playlist",
                "pl-1"
        );

        UserProgressDto result = progressApiService.saveProgress("user-abc", request);

        assertThat(result).isNotNull();
        assertThat(result.songId()).isEqualTo("song-100");
        assertThat(result.currentTime()).isEqualTo(60.0);
        assertThat(result.progressPercent()).isEqualTo(25.0);
        verify(valueOperations).set(eq("user:progress:user-abc"), any(), any(java.time.Duration.class));
    }

    @Test
    @DisplayName("getProgress should read from Redis and populate SongDto")
    void getProgress() throws Exception {
        String json = """
                {
                  "songId": "song-100",
                  "currentTime": 45.0,
                  "duration": 180.0,
                  "progressPercent": 25.0,
                  "contextType": "discover",
                  "contextId": "",
                  "updatedAt": "2026-11-10T07:00:00"
                }
                """;

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("user:progress:user-xyz")).thenReturn(json);

        Song song = Song.builder().id("song-100").title("Starboy").build();
        when(songsRepository.findById("song-100")).thenReturn(Optional.of(song));

        UserProgressDto result = progressApiService.getProgress("user-xyz");

        assertThat(result).isNotNull();
        assertThat(result.songId()).isEqualTo("song-100");
        assertThat(result.currentTime()).isEqualTo(45.0);
        assertThat(result.song()).isNotNull();
        assertThat(result.song().title()).isEqualTo("Starboy");
    }

    @Test
    @DisplayName("clearProgress should delete key from Redis")
    void clearProgress() {
        progressApiService.clearProgress("user-xyz");
        verify(redisTemplate).delete("user:progress:user-xyz");
    }
}

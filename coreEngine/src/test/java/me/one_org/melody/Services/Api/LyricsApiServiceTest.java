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

import com.fasterxml.jackson.databind.ObjectMapper;

import me.one_org.melody.Dto.Controllers.Api.LyricsDto;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Exceptions.ResourceNotFoundException;
import me.one_org.melody.Repository.SongsRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LyricsApiServiceTest {

    @Mock
    private SongsRepository songsRepository;

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @InjectMocks
    private LyricsApiService lyricsApiService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("getLyrics should return cached lyrics when present in Redis")
    void getLyricsFromCache() throws Exception {
        LyricsDto cached = new LyricsDto(
                "song-1",
                "lrc-1",
                "Tum Hi Ho",
                "Arijit Singh",
                262.0,
                false,
                "Hum tere bin...",
                "[00:15.00] Hum tere bin..."
        );
        String json = objectMapper.writeValueAsString(cached);

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("lyrics:song-1")).thenReturn(json);

        LyricsDto result = lyricsApiService.getLyrics("song-1");

        assertThat(result).isNotNull();
        assertThat(result.songId()).isEqualTo("song-1");
        assertThat(result.syncedLyrics()).isEqualTo("[00:15.00] Hum tere bin...");
        verify(songsRepository, never()).findById(anyString());
    }

    @Test
    @DisplayName("getLyrics should throw ResourceNotFoundException if song does not exist")
    void getLyricsSongNotFound() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("lyrics:unknown")).thenReturn(null);
        when(songsRepository.findById("unknown")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> lyricsApiService.getLyrics("unknown"))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}


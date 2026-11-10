package me.one_org.melody.Controllers.Api;

import java.util.concurrent.TimeUnit;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.constraints.NotBlank;
import me.one_org.melody.Dto.Controllers.Api.LyricsDto;
import me.one_org.melody.Services.Api.LyricsApiService;

@RestController
@RequestMapping("/api/lyrics")
@Validated
public class LyricsApiController {

    private final LyricsApiService lyricsApiService;

    public LyricsApiController(LyricsApiService lyricsApiService) {
        this.lyricsApiService = lyricsApiService;
    }

    /**
     * Get synchronized and plain lyrics for a song.
     * Backed by Redis cache (30-day TTL for found lyrics) and LRCLIB fallback.
     */
    @GetMapping("/{songId}")
    public ResponseEntity<LyricsDto> getLyrics(
            @PathVariable @NotBlank(message = "Song ID is required") String songId
    ) {
        LyricsDto lyrics = lyricsApiService.getLyrics(songId);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(7, TimeUnit.DAYS).cachePublic())
                .body(lyrics);
    }
}

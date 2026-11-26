package me.one_org.melody.Controllers.Api;

import java.util.concurrent.TimeUnit;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.constraints.NotBlank;
import me.one_org.melody.Dto.Controllers.Api.LyricsDto;
import me.one_org.melody.Services.Api.LyricsApiService;

/**
 * Lyrics API.
 *
 * Controller = HTTP request ka pehla stop. Ye sirf request padhta hai, service ko kaam deta hai,
 * aur response (JSON) lautata hai. Asli logic service me hai.
 */
@RestController
@RequestMapping("/api/lyrics")
@Validated
public class LyricsApiController {

    private final LyricsApiService lyricsApiService;

    public LyricsApiController(LyricsApiService lyricsApiService) {
        this.lyricsApiService = lyricsApiService;
    }

    /**
     * GET /api/lyrics/{songId} - gaane ke lyrics (synced aur plain).
     * Pehle Redis cache dekhte hain (mile hue lyrics 30 din cache rehte hain), nahi to lrclib.net se laate hain.
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


package me.one_org.melody.Controllers.Api;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.validation.annotation.Validated;
import jakarta.validation.constraints.NotBlank;
import me.one_org.melody.Dto.Controllers.Api.RadioResponseDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Recommendation.Mood;
import me.one_org.melody.Security.CurrentUser;
import me.one_org.melody.Security.CustomUserDetails;
import me.one_org.melody.Services.Api.MoodRadioService;
import me.one_org.melody.Services.Api.RecommendationApiService;

/**
 * Recommendations API (Recombee se): user ke liye, similar songs, radio, mood radio.
 *
 * Controller = HTTP request ka pehla stop. Ye sirf request padhta hai, service ko kaam deta hai,
 * aur response (JSON) lautata hai. Asli logic service me hai.
 */
@RestController
@RequestMapping("/api/recommendations")
@Validated
public class RecombeeApiController {

    private final RecommendationApiService recommendationApiService;
    private final MoodRadioService moodRadioService;

    public RecombeeApiController(RecommendationApiService recommendationApiService,
                                 MoodRadioService moodRadioService) {
        this.recommendationApiService = recommendationApiService;
        this.moodRadioService = moodRadioService;
    }

    /** GET /api/recommendations/radio/mood - mood radio: mood (chill, workout, focus, happy, sad) ke audio profile wale songs. */
    @GetMapping("/radio/mood")
    public ResponseEntity<List<SongDto>> recommendMoodRadio(
            @CurrentUser CustomUserDetails currentUser,
            @RequestParam @NotBlank(message = "Mood is required") String mood,
            @RequestParam(defaultValue = "20") int count) {
        String userId = (currentUser != null) ? currentUser.getId() : null;
        return ResponseEntity.ok(moodRadioService.recommendMood(Mood.parse(mood), userId, count));
    }

    /** GET /api/recommendations/user - is user ke liye songs ("For you"). */
    @GetMapping("/user")
    public ResponseEntity<List<SongDto>> recommendForUser(
            @CurrentUser CustomUserDetails currentUser,
            @RequestParam(defaultValue = "10") int count) {
        String userId = (currentUser != null) ? currentUser.getId() : null;
        return ResponseEntity.ok(recommendationApiService.recommendForUser(userId, count));
    }

    /** GET /api/recommendations/similar/{songId} - is gaane jaise gaane. */
    @GetMapping("/similar/{songId}")
    public ResponseEntity<List<SongDto>> recommendSimilar(
            @PathVariable @NotBlank(message = "Song ID is required") String songId,
            @RequestParam(defaultValue = "10") int count) {
        return ResponseEntity.ok(recommendationApiService.recommendSimilar(songId, count));
    }

    /** GET /api/recommendations/radio?seedSongId= - ek gaane se radio (queue bharne ke liye). */
    @GetMapping("/radio")
    public ResponseEntity<List<SongDto>> recommendRadio(
            @RequestParam @NotBlank(message = "Seed song ID is required") String seedSongId,
            @RequestParam(required = false) String excludeIds,
            @RequestParam(defaultValue = "10") int count) {
        List<String> excludedList = (excludeIds != null && !excludeIds.isBlank())
                ? List.of(excludeIds.split(","))
                : List.of();
        return ResponseEntity.ok(recommendationApiService.recommendRadio(seedSongId, excludedList, count));
    }

    /**
     * GET /api/recommendations/radio/session - radio jo session yaad rakhta hai.
     * recommId wapas deta hai; agli baar wahi bhejo to Recombee pichle suggestions ke aage se continue karta hai.
     */
    @GetMapping("/radio/session")
    public ResponseEntity<RadioResponseDto> recommendRadioSession(
            @RequestParam @NotBlank(message = "Seed song ID is required") String seedSongId,
            @RequestParam(required = false) String excludeIds,
            @RequestParam(defaultValue = "10") int count) {
        List<String> excludedList = (excludeIds != null && !excludeIds.isBlank())
                ? List.of(excludeIds.split(","))
                : List.of();
        return ResponseEntity.ok(recommendationApiService.recommendRadioSession(seedSongId, excludedList, count));
    }
}

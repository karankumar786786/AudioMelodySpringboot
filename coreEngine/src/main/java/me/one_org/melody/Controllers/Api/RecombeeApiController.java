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

    /** Mood radio: songs matching a mood's audio profile (chill, workout, focus, happy, sad). */
    @GetMapping("/radio/mood")
    public ResponseEntity<List<SongDto>> recommendMoodRadio(
            @CurrentUser CustomUserDetails currentUser,
            @RequestParam @NotBlank(message = "Mood is required") String mood,
            @RequestParam(defaultValue = "20") int count) {
        String userId = (currentUser != null) ? currentUser.getId() : null;
        return ResponseEntity.ok(moodRadioService.recommendMood(Mood.parse(mood), userId, count));
    }

    @GetMapping("/user")
    public ResponseEntity<List<SongDto>> recommendForUser(
            @CurrentUser CustomUserDetails currentUser,
            @RequestParam(defaultValue = "10") int count) {
        String userId = (currentUser != null) ? currentUser.getId() : null;
        return ResponseEntity.ok(recommendationApiService.recommendForUser(userId, count));
    }

    @GetMapping("/similar/{songId}")
    public ResponseEntity<List<SongDto>> recommendSimilar(
            @PathVariable @NotBlank(message = "Song ID is required") String songId,
            @RequestParam(defaultValue = "10") int count) {
        return ResponseEntity.ok(recommendationApiService.recommendSimilar(songId, count));
    }

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

    // P4: Session-aware radio – returns recommId for sequential continuity
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

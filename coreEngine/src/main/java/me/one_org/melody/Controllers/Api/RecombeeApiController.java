package me.one_org.melody.Controllers.Api;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Services.Api.RecommendationApiService;

@RestController
@RequestMapping("/api/recommendations")
public class RecombeeApiController {

    private final RecommendationApiService recommendationApiService;

    public RecombeeApiController(RecommendationApiService recommendationApiService) {
        this.recommendationApiService = recommendationApiService;
    }

    @GetMapping("/user")
    public ResponseEntity<List<SongDto>> recommendForUser(
            @RequestAttribute("userId") String userId,
            @RequestParam(defaultValue = "10") int count) {
        return ResponseEntity.ok(recommendationApiService.recommendForUser(userId, count));
    }

    @GetMapping("/similar/{songId}")
    public ResponseEntity<List<SongDto>> recommendSimilar(
            @PathVariable String songId,
            @RequestParam(defaultValue = "10") int count) {
        return ResponseEntity.ok(recommendationApiService.recommendSimilar(songId, count));
    }

    @GetMapping("/radio")
    public ResponseEntity<List<SongDto>> recommendRadio(
            @RequestParam String seedSongId,
            @RequestParam(required = false) String excludeIds,
            @RequestParam(defaultValue = "10") int count) {
        List<String> excludedList = (excludeIds != null && !excludeIds.isBlank())
                ? List.of(excludeIds.split(","))
                : List.of();
        return ResponseEntity.ok(recommendationApiService.recommendRadio(seedSongId, excludedList, count));
    }
}

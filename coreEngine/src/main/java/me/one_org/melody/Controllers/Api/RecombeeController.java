package me.one_org.melody.Controllers.Api;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Services.Api.RecommendationApiService;

@RestController
@RequestMapping("/api/recommendations")
public class RecombeeController {

    private final RecommendationApiService recommendationApiService;

    public RecombeeController(RecommendationApiService recommendationApiService) {
        this.recommendationApiService = recommendationApiService;
    }

    @GetMapping("/user")
    public ResponseEntity<List<SongsEntity>> recommendForUser(
            @RequestAttribute("userId") String userId,
            @RequestParam(defaultValue = "10") int count) {
        return ResponseEntity.ok(recommendationApiService.recommendForUser(userId, count));
    }

    @GetMapping("/similar/{songId}")
    public ResponseEntity<List<SongsEntity>> recommendSimilar(
            @PathVariable String songId,
            @RequestParam(defaultValue = "10") int count) {
        return ResponseEntity.ok(recommendationApiService.recommendSimilar(songId, count));
    }
}

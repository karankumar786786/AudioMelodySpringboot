package me.one_org.melody.Controllers.Api;

import java.util.List;
import java.util.concurrent.TimeUnit;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.constraints.NotBlank;
import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Services.Api.VideosApiService;

@RestController
@RequestMapping("/api/videos")
@Validated
public class VideosApiController {

    private final VideosApiService videosApiService;

    public VideosApiController(VideosApiService videosApiService) {
        this.videosApiService = videosApiService;
    }

    /**
     * Paginated videos browse endpoint with optional genre/language filters and sorting.
     * sort: "latest" (default), "popular", "trending"
     */
    @GetMapping
    public ResponseEntity<PaginatedResponseDto<SongDto>> getVideos(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size,
            @RequestParam(required = false) String genre,
            @RequestParam(required = false) String language,
            @RequestParam(defaultValue = "latest") String sort
    ) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(5, TimeUnit.MINUTES).cachePublic())
                .body(videosApiService.getVideos(page, size, genre, language, sort));
    }

    /**
     * Trending music videos based on playback and user history.
     */
    @GetMapping("/trending")
    public ResponseEntity<List<SongDto>> getTrendingVideos(
            @RequestParam(defaultValue = "15") int limit,
            @RequestParam(defaultValue = "7d") String window,
            @RequestParam(required = false) String genre,
            @RequestParam(required = false) String language
    ) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(5, TimeUnit.MINUTES).cachePublic())
                .body(videosApiService.getTrendingVideos(limit, window, genre, language));
    }

    /**
     * Popular music videos sorted by total stream count.
     */
    @GetMapping("/popular")
    public ResponseEntity<List<SongDto>> getPopularVideos(
            @RequestParam(defaultValue = "15") int limit,
            @RequestParam(required = false) String genre,
            @RequestParam(required = false) String language
    ) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(10, TimeUnit.MINUTES).cachePublic())
                .body(videosApiService.getPopularVideos(limit, genre, language));
    }

    /**
     * Contextual Up-Next / Related music videos for continuous watching.
     */
    @GetMapping("/{id}/related")
    public ResponseEntity<List<SongDto>> getRelatedVideos(
            @PathVariable @NotBlank(message = "Song ID is required") String id,
            @RequestParam(defaultValue = "10") int limit
    ) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(10, TimeUnit.MINUTES).cachePublic())
                .body(videosApiService.getRelatedVideos(id, limit));
    }

    /**
     * Paginated music videos for a specific artist.
     */
    @GetMapping("/artist/{artistName}")
    public ResponseEntity<PaginatedResponseDto<SongDto>> getVideosByArtist(
            @PathVariable @NotBlank(message = "Artist name is required") String artistName,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size
    ) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(10, TimeUnit.MINUTES).cachePublic())
                .body(videosApiService.getVideosByArtist(artistName, page, size));
    }
}


package me.one_org.melody.Controllers.Api;

import java.util.List;
import java.util.concurrent.TimeUnit;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Dto.Controllers.Api.ShortsLikeStatusDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Security.CurrentUser;
import me.one_org.melody.Security.CustomUserDetails;
import me.one_org.melody.Services.Api.CanvasApiService;
import me.one_org.melody.Services.Api.ShortsLikesApiService;

@RestController
@RequestMapping("/api/canvas")
@Validated
public class CanvasApiController {

    private final CanvasApiService canvasApiService;
    private final ShortsLikesApiService shortsLikesApiService;

    public CanvasApiController(CanvasApiService canvasApiService, ShortsLikesApiService shortsLikesApiService) {
        this.canvasApiService = canvasApiService;
        this.shortsLikesApiService = shortsLikesApiService;
    }

    /**
     * Vertical Shorts / Canvas feed for looping visual music experience.
     */
    @GetMapping("/feed")
    public ResponseEntity<PaginatedResponseDto<SongDto>> getCanvasFeed(
            @CurrentUser CustomUserDetails currentUser,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String genre,
            @RequestParam(defaultValue = "latest") String sort
    ) {
        String userId = currentUser != null ? currentUser.getId() : null;
        // If sorting randomly on refresh, do not cache anywhere (no-store) so each fetch is completely fresh
        CacheControl cache = "random".equalsIgnoreCase(sort) || "discover".equalsIgnoreCase(sort)
                ? CacheControl.noStore()
                : CacheControl.maxAge(5, TimeUnit.MINUTES).cachePublic();

        return ResponseEntity.ok()
                .cacheControl(cache)
                .body(canvasApiService.getCanvasFeed(userId, page, size, genre, sort));
    }

    /**
     * Featured vertical canvas tracks for home preview.
     */
    @GetMapping("/featured")
    public ResponseEntity<List<SongDto>> getFeaturedCanvas(
            @RequestParam(defaultValue = "10") int limit
    ) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(10, TimeUnit.MINUTES).cachePublic())
                .body(canvasApiService.getFeaturedCanvas(limit));
    }

    /**
     * Toggle like on a short (separate from library favourites).
     */
    @PostMapping("/{songId}/like")
    public ResponseEntity<ShortsLikeStatusDto> toggleLike(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable String songId
    ) {
        return ResponseEntity.ok(shortsLikesApiService.toggleLike(currentUser.getId(), songId));
    }

    /**
     * Check if a short is liked by the current user and get total likes count.
     */
    @GetMapping("/{songId}/like")
    public ResponseEntity<ShortsLikeStatusDto> getLikeStatus(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable String songId
    ) {
        String userId = currentUser != null ? currentUser.getId() : null;
        return ResponseEntity.ok(shortsLikesApiService.getLikeStatus(userId, songId));
    }

    /**
     * Get list of song IDs for shorts liked by the current user.
     */
    @GetMapping("/liked")
    public ResponseEntity<List<String>> getLikedShortSongIds(
            @CurrentUser CustomUserDetails currentUser
    ) {
        return ResponseEntity.ok(shortsLikesApiService.getLikedSongIds(currentUser.getId()));
    }

    /**
     * Get paginated songs for shorts liked by the current user.
     */
    @GetMapping("/liked/songs")
    public ResponseEntity<PaginatedResponseDto<SongDto>> getLikedShortSongs(
            @CurrentUser CustomUserDetails currentUser,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        return ResponseEntity.ok(shortsLikesApiService.getLikedShortSongs(currentUser.getId(), page, size));
    }
}



package me.one_org.melody.Controllers.Api;

import java.util.List;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Dto.Controllers.Api.ShortsLikeStatusDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;

/**
 * Retired: Shorts used to be songs with a canvas loop plus their preview window. Shorts
 * are now their own uploads under /api/shorts; the canvas stays as the player background.
 * These routes answer empty for app versions that still call them, and will be removed
 * together with the user_shorts_likes table.
 */
@RestController
@RequestMapping("/api/canvas")
public class CanvasApiController {

    private static final String DEPRECATION = "true";
    private static final String SUCCESSOR = "</api/shorts/feed>; rel=\"successor-version\"";

    private static <T> ResponseEntity<T> retired(T body) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header("Deprecation", DEPRECATION)
                .header("Link", SUCCESSOR)
                .body(body);
    }

    @GetMapping("/feed")
    public ResponseEntity<PaginatedResponseDto<SongDto>> getCanvasFeed(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return retired(PaginatedResponseDto.empty(page, size));
    }

    @GetMapping("/featured")
    public ResponseEntity<List<SongDto>> getFeaturedCanvas() {
        return retired(List.of());
    }

    @PostMapping("/{songId}/like")
    public ResponseEntity<ShortsLikeStatusDto> toggleLike(@PathVariable String songId) {
        return retired(new ShortsLikeStatusDto(songId, false, 0L));
    }

    @GetMapping("/{songId}/like")
    public ResponseEntity<ShortsLikeStatusDto> getLikeStatus(@PathVariable String songId) {
        return retired(new ShortsLikeStatusDto(songId, false, 0L));
    }

    @GetMapping("/liked")
    public ResponseEntity<List<String>> getLikedShortSongIds() {
        return retired(List.of());
    }

    @GetMapping("/liked/songs")
    public ResponseEntity<PaginatedResponseDto<SongDto>> getLikedShortSongs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return retired(PaginatedResponseDto.empty(page, size));
    }
}

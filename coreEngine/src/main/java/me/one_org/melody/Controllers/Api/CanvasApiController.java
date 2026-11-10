package me.one_org.melody.Controllers.Api;

import java.util.List;
import java.util.concurrent.TimeUnit;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Services.Api.CanvasApiService;

@RestController
@RequestMapping("/api/canvas")
@Validated
public class CanvasApiController {

    private final CanvasApiService canvasApiService;

    public CanvasApiController(CanvasApiService canvasApiService) {
        this.canvasApiService = canvasApiService;
    }

    /**
     * Vertical Shorts / Canvas feed for looping visual music experience.
     */
    @GetMapping("/feed")
    public ResponseEntity<PaginatedResponseDto<SongDto>> getCanvasFeed(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String genre,
            @RequestParam(defaultValue = "latest") String sort
    ) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(5, TimeUnit.MINUTES).cachePublic())
                .body(canvasApiService.getCanvasFeed(page, size, genre, sort));
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
}


package me.one_org.melody.Controllers.Api;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Dto.Controllers.Api.ArtistDto;
import me.one_org.melody.Dto.Controllers.Api.PaginationMetaDataDto;
import me.one_org.melody.Dto.Controllers.Api.PlaylistDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Dto.Controllers.Api.UserHistoryResponseDto;
import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Services.Api.ArtistApiService;
import me.one_org.melody.Services.Api.PlaylistApiService;
import me.one_org.melody.Services.Api.RecommendationApiService;
import me.one_org.melody.Services.Api.SongsApiService;
import me.one_org.melody.Services.Api.UserHistoryApiService;

/**
 * Server-Sent Events (SSE) streaming API for the Home feed.
 * Aggregates and streams each section (featured, trending, artists, playlists, feed,
 * recently played, recommendations) progressively down a single HTTP connection,
 * eliminating the initial 7x API request spike during homepage loads.
 */
@RestController
@RequestMapping("/api/home")
@Slf4j
public class HomeApiController {

    private final SongsApiService songsApiService;
    private final ArtistApiService artistApiService;
    private final PlaylistApiService playlistApiService;
    private final UserHistoryApiService userHistoryApiService;
    private final RecommendationApiService recommendationApiService;

    // Use Java 21 Virtual Threads for lightweight, non-blocking asynchronous streaming
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    public HomeApiController(
            SongsApiService songsApiService,
            ArtistApiService artistApiService,
            PlaylistApiService playlistApiService,
            UserHistoryApiService userHistoryApiService,
            RecommendationApiService recommendationApiService) {
        this.songsApiService = songsApiService;
        this.artistApiService = artistApiService;
        this.playlistApiService = playlistApiService;
        this.userHistoryApiService = userHistoryApiService;
        this.recommendationApiService = recommendationApiService;
    }

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamHomeFeed(
            @RequestAttribute(value = "userId", required = false) String userId,
            @RequestParam(value = "userId", required = false) String userIdParam) {

        final String effectiveUserId = (userId != null && !userId.isBlank()) ? userId : userIdParam;
        log.info("[HomeStream] Opening SSE stream for user [{}]", effectiveUserId != null ? effectiveUserId : "anonymous");

        // 45 seconds timeout
        SseEmitter emitter = new SseEmitter(45_000L);

        emitter.onCompletion(() -> log.debug("[HomeStream] SSE connection completed for user [{}]", effectiveUserId));
        emitter.onTimeout(() -> {
            log.debug("[HomeStream] SSE connection timed out for user [{}]", effectiveUserId);
            emitter.complete();
        });
        emitter.onError(ex -> log.debug("[HomeStream] SSE connection error for user [{}]: {}", effectiveUserId, ex.getMessage()));

        List<CompletableFuture<Void>> tasks = new ArrayList<>();

        // 1. Featured Songs
        tasks.add(CompletableFuture.runAsync(() -> {
            try {
                List<SongDto> featured = songsApiService.getFeaturedSongs();
                sendEvent(emitter, "featured", featured);
            } catch (Exception e) {
                log.warn("[HomeStream] Failed to fetch featured songs: {}", e.getMessage());
            }
        }, executor));

        // 2. Trending Songs (Limit 12)
        tasks.add(CompletableFuture.runAsync(() -> {
            try {
                List<SongDto> trending = songsApiService.getTrendingSongs(12);
                sendEvent(emitter, "trending", Map.of("data", Map.of("data", trending)));
            } catch (Exception e) {
                log.warn("[HomeStream] Failed to fetch trending songs: {}", e.getMessage());
            }
        }, executor));

        // 3. Top Artists (Page 0, Size 15)
        tasks.add(CompletableFuture.runAsync(() -> {
            try {
                List<ArtistDto> artists = artistApiService.getArtistsPaginated(0, 15);
                PaginationMetaDataDto meta = artistApiService.getPaginationMetaData();
                sendEvent(emitter, "artists", new PaginatedResponseDto<>(artists, 0, 15, meta));
            } catch (Exception e) {
                log.warn("[HomeStream] Failed to fetch top artists: {}", e.getMessage());
            }
        }, executor));

        // 4. Featured Playlists (Page 0, Size 15)
        tasks.add(CompletableFuture.runAsync(() -> {
            try {
                List<PlaylistDto> playlists = playlistApiService.getPlaylistsPaginated(0, 15);
                PaginationMetaDataDto meta = playlistApiService.getPaginationMetaData();
                sendEvent(emitter, "playlists", new PaginatedResponseDto<>(playlists, 0, 15, meta));
            } catch (Exception e) {
                log.warn("[HomeStream] Failed to fetch playlists: {}", e.getMessage());
            }
        }, executor));

        // 5. Discover Feed Initial Page (Page 0, Size 15)
        tasks.add(CompletableFuture.runAsync(() -> {
            try {
                List<SongDto> feed = songsApiService.browseSongs(0, 15);
                PaginationMetaDataDto meta = songsApiService.getPaginationMetaData();
                sendEvent(emitter, "feed", new PaginatedResponseDto<>(feed, 0, 15, meta));
            } catch (Exception e) {
                log.warn("[HomeStream] Failed to fetch discover feed: {}", e.getMessage());
            }
        }, executor));

        // 6. User-Specific Personalized Content (if authenticated)
        if (effectiveUserId != null && !effectiveUserId.isBlank()) {
            // Recently Played
            tasks.add(CompletableFuture.runAsync(() -> {
                try {
                    List<UserHistoryResponseDto> recent = userHistoryApiService.getRecentlyPlayed(effectiveUserId);
                    sendEvent(emitter, "recentlyPlayed", Map.of("data", Map.of("data", recent)));
                } catch (Exception e) {
                    log.warn("[HomeStream] Failed to fetch recently played for user [{}]: {}", effectiveUserId, e.getMessage());
                }
            }, executor));

            // Personalized Recommendations
            tasks.add(CompletableFuture.runAsync(() -> {
                try {
                    List<SongDto> recs = recommendationApiService.recommendForUser(effectiveUserId, 10);
                    sendEvent(emitter, "recommendations", Map.of("data", Map.of("data", recs)));
                } catch (Exception e) {
                    log.warn("[HomeStream] Failed to fetch recommendations for user [{}]: {}", effectiveUserId, e.getMessage());
                }
            }, executor));
        }

        // When all independent sections finish streaming, send "complete" signal and close cleanly
        CompletableFuture.allOf(tasks.toArray(new CompletableFuture[0]))
                .whenComplete((res, err) -> {
                    try {
                        sendEvent(emitter, "complete", Map.of("status", "SUCCESS"));
                        emitter.complete();
                    } catch (Exception ignored) {}
                });

        return emitter;
    }

    private void sendEvent(SseEmitter emitter, String eventName, Object data) {
        synchronized (emitter) {
            try {
                emitter.send(SseEmitter.event()
                        .name(eventName)
                        .data(data));
            } catch (Exception e) {
                log.debug("[HomeStream] SSE write failed for event [{}]: {}", eventName, e.getMessage());
            }
        }
    }
}

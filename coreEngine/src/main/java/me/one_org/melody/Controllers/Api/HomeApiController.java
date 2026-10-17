package me.one_org.melody.Controllers.Api;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

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
import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Services.Api.ArtistApiService;
import me.one_org.melody.Services.Api.PlaylistApiService;
import me.one_org.melody.Services.Api.RecommendationApiService;
import me.one_org.melody.Services.Api.SongsApiService;

/**
 * Server-Sent Events (SSE) streaming API for the Home feed.
 * Aggregates and streams each section progressively down a single HTTP connection.
 *
 * DB Resource Optimization:
 * Instead of firing concurrent background tasks that hoard pool connections simultaneously,
 * this stream processes each section sequentially:
 *   1. Borrow DB connection for Section N
 *   2. Execute query & immediately release connection back to HikariCP pool
 *   3. Send SSE event down the wire (0 DB connections held during network transmission)
 *   4. Proceed to Section N + 1
 * If the client aborts or navigates away, remaining DB fetches are cancelled immediately.
 */
@RestController
@RequestMapping("/api/home")
@Slf4j
public class HomeApiController {

    private final SongsApiService songsApiService;
    private final ArtistApiService artistApiService;
    private final PlaylistApiService playlistApiService;
    private final RecommendationApiService recommendationApiService;

    // Use Java 21 Virtual Threads for lightweight, non-blocking asynchronous streaming
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    public HomeApiController(
            SongsApiService songsApiService,
            ArtistApiService artistApiService,
            PlaylistApiService playlistApiService,
            RecommendationApiService recommendationApiService) {
        this.songsApiService = songsApiService;
        this.artistApiService = artistApiService;
        this.playlistApiService = playlistApiService;
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
        AtomicBoolean isClosed = new AtomicBoolean(false);

        emitter.onCompletion(() -> {
            isClosed.set(true);
            log.debug("[HomeStream] SSE connection completed for user [{}]", effectiveUserId);
        });
        emitter.onTimeout(() -> {
            isClosed.set(true);
            log.debug("[HomeStream] SSE connection timed out for user [{}]", effectiveUserId);
            emitter.complete();
        });
        emitter.onError(ex -> {
            isClosed.set(true);
            log.debug("[HomeStream] SSE connection error for user [{}]: {}", effectiveUserId, ex.getMessage());
        });

        // Run sequentially on a single virtual thread:
        // Each service call acquires and immediately releases its DB connection back to the Hikari pool.
        // During sendEvent(), ZERO database connections are held!
        executor.submit(() -> {
            try {
                // 1. Featured Songs
                if (!isClosed.get()) {
                    try {
                        List<SongDto> featured = songsApiService.getFeaturedSongs();
                        sendEvent(emitter, isClosed, "featured", featured);
                    } catch (Exception e) {
                        log.warn("[HomeStream] Failed to fetch featured songs: {}", e.getMessage());
                    }
                }

                // 2. Trending Songs (Limit 12)
                if (!isClosed.get()) {
                    try {
                        List<SongDto> trending = songsApiService.getTrendingSongs(12);
                        sendEvent(emitter, isClosed, "trending", Map.of("data", Map.of("data", trending)));
                    } catch (Exception e) {
                        log.warn("[HomeStream] Failed to fetch trending songs: {}", e.getMessage());
                    }
                }

                // 3. Top Artists (Page 0, Size 15)
                if (!isClosed.get()) {
                    try {
                        List<ArtistDto> artists = artistApiService.getArtistsPaginated(0, 15);
                        PaginationMetaDataDto meta = artistApiService.getPaginationMetaData();
                        sendEvent(emitter, isClosed, "artists", new PaginatedResponseDto<>(artists, 0, 15, meta));
                    } catch (Exception e) {
                        log.warn("[HomeStream] Failed to fetch top artists: {}", e.getMessage());
                    }
                }

                // 4. Featured Playlists (Page 0, Size 15)
                if (!isClosed.get()) {
                    try {
                        List<PlaylistDto> playlists = playlistApiService.getPlaylistsPaginated(0, 15);
                        PaginationMetaDataDto meta = playlistApiService.getPaginationMetaData();
                        sendEvent(emitter, isClosed, "playlists", new PaginatedResponseDto<>(playlists, 0, 15, meta));
                    } catch (Exception e) {
                        log.warn("[HomeStream] Failed to fetch playlists: {}", e.getMessage());
                    }
                }

                // 5. Discover Feed Initial Page (Page 0, Size 15)
                if (!isClosed.get()) {
                    try {
                        List<SongDto> feed = songsApiService.browseSongs(0, 15);
                        PaginationMetaDataDto meta = songsApiService.getPaginationMetaData();
                        sendEvent(emitter, isClosed, "feed", new PaginatedResponseDto<>(feed, 0, 15, meta));
                    } catch (Exception e) {
                        log.warn("[HomeStream] Failed to fetch discover feed: {}", e.getMessage());
                    }
                }

                // 6. User-Specific Personalized Content (if authenticated)
                if (effectiveUserId != null && !effectiveUserId.isBlank()) {
                    // Personalized Recommendations
                    if (!isClosed.get()) {
                        try {
                            List<SongDto> recs = recommendationApiService.recommendForUser(effectiveUserId, 10);
                            sendEvent(emitter, isClosed, "recommendations", Map.of("data", Map.of("data", recs)));
                        } catch (Exception e) {
                            log.warn("[HomeStream] Failed to fetch recommendations for user [{}]: {}", effectiveUserId, e.getMessage());
                        }
                    }
                }

                // 7. Complete Signal
                if (!isClosed.get()) {
                    sendEvent(emitter, isClosed, "complete", Map.of("status", "SUCCESS"));
                    emitter.complete();
                }
            } catch (Exception ex) {
                log.warn("[HomeStream] Stream terminated unexpectedly: {}", ex.getMessage());
                if (!isClosed.get()) {
                    emitter.completeWithError(ex);
                }
            }
        });

        return emitter;
    }

    private void sendEvent(SseEmitter emitter, AtomicBoolean isClosed, String eventName, Object data) {
        if (isClosed.get()) return;
        synchronized (emitter) {
            try {
                emitter.send(SseEmitter.event()
                        .name(eventName)
                        .data(data));
            } catch (Exception e) {
                isClosed.set(true);
                log.debug("[HomeStream] SSE write failed for event [{}], closing: {}", eventName, e.getMessage());
            }
        }
    }
}

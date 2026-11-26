package me.one_org.melody.Controllers.Api;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Dto.Controllers.Api.ArtistDto;
import me.one_org.melody.Dto.Controllers.Api.PaginationMetaDataDto;
import me.one_org.melody.Dto.Controllers.Api.PlaylistDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Security.CurrentUser;
import me.one_org.melody.Security.CustomUserDetails;
import me.one_org.melody.Services.Api.ArtistApiService;
import me.one_org.melody.Services.Api.PlaylistApiService;
import me.one_org.melody.Services.Api.RecommendationApiService;
import me.one_org.melody.Services.Api.SongsApiService;

/**
 * Home screen ka data SSE (Server-Sent Events) se, ek hi HTTP connection pe, section by section.
 * SSE = server ek connection khula rakh ke data ke tukde (events) ek ek karke bhejta hai.
 * Isse app pehla section (featured songs) turant dikha deta hai, baaki ke aane ka wait nahi karta.
 *
 * Database connections bachane ka tareeka:
 * Saare sections ek saath (parallel) laane se bahut saare DB connections ek saath pakde jaate.
 * Isliye sections ek ke baad ek aate hain:
 *   1. Section N ke liye DB connection lo
 *   2. Query chalao aur connection turant pool me wapas do
 *   3. SSE event bhejo (network pe bhejte waqt koi DB connection pakda hua nahi hai)
 *   4. Agle section pe jao
 * User beech me screen chhod de to baaki queries turant cancel.
 */
@RestController
@RequestMapping("/api/home")
@Slf4j
public class HomeApiController {

    private final SongsApiService songsApiService;
    private final ArtistApiService artistApiService;
    private final PlaylistApiService playlistApiService;
    private final RecommendationApiService recommendationApiService;

    // Java 21 ke virtual threads: bahut halke threads, har stream ke liye ek - hazaaron bhi chalein to dikkat nahi
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

    /**
     * GET /api/home/stream - home feed ke saare sections SSE se bhejta hai.
     * Koi ek section fail ho to baaki chalte rehte hain.
     */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamHomeFeed(@CurrentUser CustomUserDetails currentUser) {
        final String userId = (currentUser != null) ? currentUser.getId() : null;
        log.info("[HomeStream] Opening SSE stream for user [{}]", userId != null ? userId : "anonymous");

        // 45 second me poora feed na aaye to stream band
        SseEmitter emitter = new SseEmitter(45_000L);
        AtomicBoolean isClosed = new AtomicBoolean(false);

        emitter.onCompletion(() -> {
            isClosed.set(true);
            log.debug("[HomeStream] SSE connection completed for user [{}]", userId);
        });
        emitter.onTimeout(() -> {
            isClosed.set(true);
            log.debug("[HomeStream] SSE connection timed out for user [{}]", userId);
            emitter.complete();
        });
        emitter.onError(ex -> {
            isClosed.set(true);
            log.debug("[HomeStream] SSE connection error for user [{}]: {}", userId, ex.getMessage());
        });

        // Ek hi virtual thread pe, ek ke baad ek:
        // har service call DB connection leti hai aur turant wapas kar deti hai.
        // sendEvent() ke time ek bhi DB connection pakda hua nahi hota!
        executor.submit(() -> {
            try {
                // 1. Featured songs
                if (!isClosed.get()) {
                    try {
                        List<SongDto> featured = songsApiService.getFeaturedSongs();
                        sendEvent(emitter, isClosed, "featured", featured);
                    } catch (Exception e) {
                        log.warn("[HomeStream] Failed to fetch featured songs: {}", e.getMessage());
                    }
                }

                // 2. Trending songs (12)
                if (!isClosed.get()) {
                    try {
                        List<SongDto> trending = songsApiService.getTrendingSongs(12);
                        sendEvent(emitter, isClosed, "trending", Map.of("data", Map.of("data", trending)));
                    } catch (Exception e) {
                        log.warn("[HomeStream] Failed to fetch trending songs: {}", e.getMessage());
                    }
                }

                // 3. Music videos (15)
                if (!isClosed.get()) {
                    try {
                        List<SongDto> videos = songsApiService.getSongsWithVideo(15);
                        sendEvent(emitter, isClosed, "videos", videos);
                    } catch (Exception e) {
                        log.warn("[HomeStream] Failed to fetch music videos: {}", e.getMessage());
                    }
                }

                // 4. Top artists (pehle 15)
                if (!isClosed.get()) {
                    try {
                        List<ArtistDto> artists = artistApiService.getArtistsPaginated(0, 15);
                        PaginationMetaDataDto meta = artistApiService.getPaginationMetaData();
                        sendEvent(emitter, isClosed, "artists", new PaginatedResponseDto<>(artists, 0, 15, meta));
                    } catch (Exception e) {
                        log.warn("[HomeStream] Failed to fetch top artists: {}", e.getMessage());
                    }
                }

                // 5. Playlists (pehli 15)
                if (!isClosed.get()) {
                    try {
                        List<PlaylistDto> playlists = playlistApiService.getPlaylistsPaginated(0, 15);
                        PaginationMetaDataDto meta = playlistApiService.getPaginationMetaData();
                        sendEvent(emitter, isClosed, "playlists", new PaginatedResponseDto<>(playlists, 0, 15, meta));
                    } catch (Exception e) {
                        log.warn("[HomeStream] Failed to fetch playlists: {}", e.getMessage());
                    }
                }

                // 6. Discover feed ka pehla page (15)
                if (!isClosed.get()) {
                    try {
                        List<SongDto> feed = songsApiService.browseSongs(0, 15);
                        PaginationMetaDataDto meta = songsApiService.getPaginationMetaData();
                        sendEvent(emitter, isClosed, "feed", new PaginatedResponseDto<>(feed, 0, 15, meta));
                    } catch (Exception e) {
                        log.warn("[HomeStream] Failed to fetch discover feed: {}", e.getMessage());
                    }
                }

                // 7. Logged-in user ke liye personal cheezein
                if (userId != null && !userId.isBlank()) {
                    // User ke liye recommendations
                    if (!isClosed.get()) {
                        try {
                            List<SongDto> recs = recommendationApiService.recommendForUser(userId, 10);
                            sendEvent(emitter, isClosed, "recommendations", Map.of("data", Map.of("data", recs)));
                        } catch (Exception e) {
                            log.warn("[HomeStream] Failed to fetch recommendations for user [{}]: {}", userId, e.getMessage());
                        }
                    }
                }

                // 8. "Sab aa gaya" signal, taaki app loading band kar de
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

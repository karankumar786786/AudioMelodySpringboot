package me.one_org.melody.Controllers.Api;

import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import me.one_org.melody.Dto.Controllers.Api.InteractionBatchRequestDto;
import me.one_org.melody.Dto.Controllers.Api.PaginationMetaDataDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Dto.Controllers.Api.TrackPlayRequestDto;
import me.one_org.melody.Dto.Controllers.Api.TrackSearchClickRequestDto;
import me.one_org.melody.Dto.Controllers.Api.TrackSearchPlayRequestDto;
import me.one_org.melody.Dto.Controllers.Api.TrackSkipRequestDto;
import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Events.Kafka.EventsMode;
import me.one_org.melody.Events.Kafka.ListenDetail;
import me.one_org.melody.Events.Kafka.TelemetryProducer;
import me.one_org.melody.Events.Kafka.TelemetryRateLimiter;
import me.one_org.melody.Exceptions.UnauthorizedException;
import me.one_org.melody.Security.CurrentUser;
import me.one_org.melody.Security.CustomUserDetails;
import me.one_org.melody.Services.Api.InteractionApiService;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import me.oneorg.melody.events.FeedbackAction;
import me.oneorg.melody.events.QueueAction;
import me.oneorg.melody.events.SearchAction;

/**
 * User ki activity (telemetry) aur favourites ki API: /api/interaction/...
 * App har play, skip, search click, queue change, dislike, share yahan bhejta hai.
 *
 * EVENTS_MODE ke hisaab se:
 * - LEGACY/DUAL: purani service kaam karti hai (DUAL me Kafka event bhi jaata hai) -> 200 OK
 * - KAFKA: sirf Kafka event jaata hai -> 202 Accepted ("le liya, baad me process hoga")
 * Har user ki rate limit lagti hai (TelemetryRateLimiter).
 *
 * Controller = HTTP request ka pehla stop. Ye sirf request padhta hai, service ko kaam deta hai,
 * aur response (JSON) lautata hai. Asli logic service me hai.
 */
@RestController
@RequestMapping("/api/interaction")
@Validated
public class InteractionApiController {

    private final InteractionApiService interactionAppService;
    private final TelemetryProducer telemetry;
    private final TelemetryRateLimiter rateLimiter;
    private final EventsMode mode;

    /** Sirf LEGACY mode wala constructor - tests me controller ko akele chalane ke liye. */
    public InteractionApiController(InteractionApiService interactionAppService) {
        this(interactionAppService, null, null, EventsMode.LEGACY);
    }

    @Autowired
    public InteractionApiController(InteractionApiService interactionAppService,
                                    TelemetryProducer telemetry,
                                    TelemetryRateLimiter rateLimiter,
                                    me.one_org.melody.Events.Kafka.EventsProperties eventsProperties) {
        this(interactionAppService, telemetry, rateLimiter, eventsProperties.mode());
    }

    private InteractionApiController(InteractionApiService interactionAppService, TelemetryProducer telemetry,
                                     TelemetryRateLimiter rateLimiter, EventsMode mode) {
        this.interactionAppService = interactionAppService;
        this.telemetry = telemetry;
        this.rateLimiter = rateLimiter;
        this.mode = mode;
    }

    // ── Telemetry endpoints ──
    // LEGACY/DUAL: purani service kaam karti hai (DUAL me event bhi jaata hai).
    // KAFKA: sirf event jaata hai aur jawab 202 Accepted.

    /** POST /api/interaction/play - ek gaana suna (kitna %, aur optional listening detail). */
    @PostMapping("/play")
    public ResponseEntity<Void> trackPlay(
            @CurrentUser CustomUserDetails currentUser,
            @Valid @RequestBody TrackPlayRequestDto data) {
        String userId = requireUser(currentUser);
        if (sendsEvents()) {
            rateLimiter.consume(userId, 1);
            ListenDetail detail = ListenDetail.of(data.ranges(), data.exitMs(), data.skipped(), data.seeks(),
                    data.quality(), data.platform(), data.startupMs(), data.rebufferCount(), data.rebufferMs(),
                    data.durationMs());
            telemetry.play(userId, data.songId(), data.percentage(), data.durationMs(), detail);
        }
        if (mode.runsLegacyPath()) {
            interactionAppService.trackPlay(userId, data.songId(), data.percentage());
        }
        return done();
    }

    /** POST /api/interaction/skip - gaana skip kiya. */
    @PostMapping("/skip")
    public ResponseEntity<Void> trackSkip(
            @CurrentUser CustomUserDetails currentUser,
            @Valid @RequestBody TrackSkipRequestDto data) {
        String userId = requireUser(currentUser);
        if (sendsEvents()) {
            rateLimiter.consume(userId, 1);
            telemetry.skip(userId, data.songId(), data.positionMs());
        }
        if (mode.runsLegacyPath()) {
            interactionAppService.trackSkip(userId, data.songId());
        }
        return done();
    }

    /** POST /api/interaction/search-play - search result se gaana chalaya. */
    @PostMapping("/search-play")
    public ResponseEntity<Void> trackSearchPlay(
            @CurrentUser CustomUserDetails currentUser,
            @Valid @RequestBody TrackSearchPlayRequestDto data) {
        String userId = currentUser != null ? currentUser.getId() : null;
        if (sendsEvents()) {
            rateLimiter.consume(rateKey(userId), 1);
            telemetry.search(userId, SearchAction.PLAY, "SONG", data.songId());
        }
        if (mode.runsLegacyPath()) {
            interactionAppService.trackSearchPlay(userId, data.songId());
        }
        return done();
    }

    /** POST /api/interaction/search-click - search result pe click kiya. */
    @PostMapping("/search-click")
    public ResponseEntity<Void> trackSearchClick(
            @CurrentUser CustomUserDetails currentUser,
            @Valid @RequestBody TrackSearchClickRequestDto data) {
        String userId = currentUser != null ? currentUser.getId() : null;
        if (sendsEvents()) {
            rateLimiter.consume(rateKey(userId), 1);
            String type = data.type() == null || data.type().isBlank() ? "SONG" : data.type().trim().toUpperCase();
            telemetry.search(userId, SearchAction.CLICK, type, data.id());
        }
        if (mode.runsLegacyPath()) {
            interactionAppService.trackSearchClick(userId, data.type(), data.id());
        }
        return done();
    }

    /** POST /api/interaction/queue-add - queue me gaana joda. */
    @PostMapping("/queue-add")
    public ResponseEntity<Void> trackQueueAdd(
            @CurrentUser CustomUserDetails currentUser,
            @Valid @RequestBody TrackSearchPlayRequestDto data) {
        if (currentUser != null) {
            if (sendsEvents()) {
                rateLimiter.consume(currentUser.getId(), 1);
                telemetry.queue(currentUser.getId(), data.songId(), QueueAction.ADD);
            }
            if (mode.runsLegacyPath()) {
                interactionAppService.trackQueueAdd(currentUser.getId(), data.songId());
            }
        }
        return done();
    }

    /** POST /api/interaction/queue-remove - queue se gaana hataya. */
    @PostMapping("/queue-remove")
    public ResponseEntity<Void> trackQueueRemove(
            @CurrentUser CustomUserDetails currentUser,
            @Valid @RequestBody TrackSearchPlayRequestDto data) {
        if (currentUser != null) {
            if (sendsEvents()) {
                rateLimiter.consume(currentUser.getId(), 1);
                telemetry.queue(currentUser.getId(), data.songId(), QueueAction.REMOVE);
            }
            if (mode.runsLegacyPath()) {
                interactionAppService.trackQueueRemove(currentUser.getId(), data.songId());
            }
        }
        return done();
    }

    /** POST /api/interaction/dislike - gaana pasand nahi aaya. */
    @PostMapping("/dislike")
    public ResponseEntity<Void> trackDislike(
            @CurrentUser CustomUserDetails currentUser,
            @Valid @RequestBody TrackSkipRequestDto data) {
        if (currentUser != null) {
            if (sendsEvents()) {
                rateLimiter.consume(currentUser.getId(), 1);
                telemetry.feedback(currentUser.getId(), data.songId(), FeedbackAction.DISLIKE);
            }
            if (mode.runsLegacyPath()) {
                interactionAppService.trackDislike(currentUser.getId(), data.songId());
            }
        }
        return done();
    }

    /** POST /api/interaction/share - gaana share kiya. */
    @PostMapping("/share")
    public ResponseEntity<Void> trackShare(
            @CurrentUser CustomUserDetails currentUser,
            @Valid @RequestBody TrackSkipRequestDto data) {
        if (currentUser != null) {
            if (sendsEvents()) {
                rateLimiter.consume(currentUser.getId(), 1);
                telemetry.feedback(currentUser.getId(), data.songId(), FeedbackAction.SHARE);
            }
            if (mode.runsLegacyPath()) {
                interactionAppService.trackShare(currentUser.getId(), data.songId());
            }
        }
        return done();
    }

    /**
     * POST /api/interaction/batch - app ki queue se ek call me 50 tak events.
     * Sirf DUAL/KAFKA mode me chalta hai. LEGACY me 404 deta hai, to app samajh jaata hai
     * ki batch nahi chalta aur ek ek event wale purane endpoints use karta hai.
     */
    @PostMapping("/batch")
    public ResponseEntity<Map<String, Integer>> trackBatch(
            @CurrentUser CustomUserDetails currentUser,
            @Valid @RequestBody InteractionBatchRequestDto data) {
        String userId = requireUser(currentUser);
        if (!sendsEvents()) {
            return ResponseEntity.notFound().build();
        }
        rateLimiter.consume(userId, data.events().size());
        int accepted = telemetry.batch(userId, data.events());
        if (mode == EventsMode.DUAL) {
            // DUAL mode me purana raasta hi asli hai, isliye har event purani service se bhi chalao.
            data.events().forEach(e -> replayLegacy(userId, e));
        }
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of("accepted", accepted));
    }

    /** Batch ke ek event ko purani service se chalao (DUAL mode). Error aaye to ignore. */
    private void replayLegacy(String userId, InteractionBatchRequestDto.Event e) {
        try {
            switch (e.type().trim().toLowerCase()) {
                case "play" -> interactionAppService.trackPlay(userId, e.songId(), e.percentage() == null ? 0.0 : e.percentage());
                case "skip" -> interactionAppService.trackSkip(userId, e.songId());
                case "search-play" -> interactionAppService.trackSearchPlay(userId, e.songId());
                case "search-click" -> interactionAppService.trackSearchClick(userId, e.entityType(), e.entityId());
                case "queue-add" -> interactionAppService.trackQueueAdd(userId, e.songId());
                case "queue-remove" -> interactionAppService.trackQueueRemove(userId, e.songId());
                case "dislike" -> interactionAppService.trackDislike(userId, e.songId());
                case "share" -> interactionAppService.trackShare(userId, e.songId());
                default -> { }
            }
        } catch (RuntimeException ex) {
            // Jaise: event queue me tha tab tak song delete ho gaya. Event to accept ho chuka hai, ignore karo.
        }
    }

    /** Kafka pe events bhejne hain? */
    private boolean sendsEvents() {
        return mode.producesEvents() && telemetry != null;
    }

    /** Telemetry ka jawab: KAFKA mode me 202 Accepted, warna 200 OK. */
    private ResponseEntity<Void> done() {
        return mode == EventsMode.KAFKA ? ResponseEntity.accepted().build() : ResponseEntity.ok().build();
    }

    /** Login zaroori hai - nahi to 401. User ki id lautata hai. */
    private static String requireUser(CustomUserDetails currentUser) {
        if (currentUser == null) throw new UnauthorizedException("Login required");
        return currentUser.getId();
    }

    /** Rate limit ki key: user id, ya login na ho to "anonymous". */
    private static String rateKey(String userId) {
        return userId != null ? userId : TelemetryProducer.ANONYMOUS;
    }

    /** POST /api/interaction/favourite/{songId} - favourite me jodo. */
    @PostMapping("/favourite/{songId}")
    public ResponseEntity<Void> addFavourite(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Song ID is required") String songId) {
        interactionAppService.addFavourite(currentUser.getId(), songId);
        return ResponseEntity.ok().build();
    }

    /** DELETE /api/interaction/favourite/{songId} - favourite se hatao (204). */
    @DeleteMapping("/favourite/{songId}")
    public ResponseEntity<Void> removeFavourite(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Song ID is required") String songId) {
        interactionAppService.removeFavourite(currentUser.getId(), songId);
        return ResponseEntity.noContent().build();
    }

    /** GET /api/interaction/favourites - user ke favourite songs, page by page. */
    @GetMapping("/favourites")
    public ResponseEntity<PaginatedResponseDto<SongDto>> getFavourites(
            @CurrentUser CustomUserDetails currentUser,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<SongDto> favourites = interactionAppService.getFavouritesPaginated(currentUser.getId(), page, size);
        PaginationMetaDataDto metaData = interactionAppService.getFavouritesPaginationMetaData(currentUser.getId());
        return ResponseEntity.ok(new PaginatedResponseDto<>(favourites, page, size, metaData));
    }
}

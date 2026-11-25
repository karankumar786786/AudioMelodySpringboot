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

@RestController
@RequestMapping("/api/interaction")
@Validated
public class InteractionApiController {

    private final InteractionApiService interactionAppService;
    private final TelemetryProducer telemetry;
    private final TelemetryRateLimiter rateLimiter;
    private final EventsMode mode;

    /** LEGACY-only wiring, kept for standalone controller tests. */
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

    // Telemetry endpoints. LEGACY/DUAL: the existing service does the work (and DUAL also
    // sends the event). KAFKA: only the event is sent and the call answers 202 Accepted.

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
     * Up to 50 events from the app's queue in one call. Only available once events go to
     * Kafka (DUAL or KAFKA); in LEGACY mode it answers 404 so the app keeps single calls.
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
            // Keep the legacy path authoritative during the comparison week.
            data.events().forEach(e -> replayLegacy(userId, e));
        }
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of("accepted", accepted));
    }

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
            // e.g. a song deleted since the event was queued; the event itself was accepted.
        }
    }

    private boolean sendsEvents() {
        return mode.producesEvents() && telemetry != null;
    }

    private ResponseEntity<Void> done() {
        return mode == EventsMode.KAFKA ? ResponseEntity.accepted().build() : ResponseEntity.ok().build();
    }

    private static String requireUser(CustomUserDetails currentUser) {
        if (currentUser == null) throw new UnauthorizedException("Login required");
        return currentUser.getId();
    }

    private static String rateKey(String userId) {
        return userId != null ? userId : TelemetryProducer.ANONYMOUS;
    }

    @PostMapping("/favourite/{songId}")
    public ResponseEntity<Void> addFavourite(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Song ID is required") String songId) {
        interactionAppService.addFavourite(currentUser.getId(), songId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/favourite/{songId}")
    public ResponseEntity<Void> removeFavourite(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Song ID is required") String songId) {
        interactionAppService.removeFavourite(currentUser.getId(), songId);
        return ResponseEntity.noContent().build();
    }

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

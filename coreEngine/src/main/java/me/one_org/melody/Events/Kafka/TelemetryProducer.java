package me.one_org.melody.Events.Kafka;

import java.time.Instant;
import java.util.List;
import java.util.Locale;

import org.springframework.stereotype.Service;

import me.one_org.melody.Dto.Controllers.Api.InteractionBatchRequestDto;
import me.one_org.melody.Exceptions.BadRequestException;
import me.oneorg.melody.events.EventIds;
import me.oneorg.melody.events.EventMeta;
import me.oneorg.melody.events.FeedbackAction;
import me.oneorg.melody.events.PlayEvent;
import me.oneorg.melody.events.QueueAction;
import me.oneorg.melody.events.QueueChange;
import me.oneorg.melody.events.SearchAction;
import me.oneorg.melody.events.SearchInteraction;
import me.oneorg.melody.events.SkipEvent;
import me.oneorg.melody.events.SongFeedback;
import me.oneorg.melody.events.Topics;

/**
 * Telemetry (play, skip, search, queue, feedback) ko Avro events bana ke Kafka pe bhejta hai.
 * User id hamesha login token se aata hai, request body se kabhi nahi - taaki koi doosre
 * user ke naam se events na bhej sake.
 * Har event ka key = userId, isliye ek user ke saare events ek hi Kafka partition me order me jaate hain.
 */
@Service
public class TelemetryProducer {

    public static final String ANONYMOUS = "anonymous";
    private static final int MAX_ID_LENGTH = 255;

    private final EventPublisher publisher;
    private final EventsProperties properties;

    public TelemetryProducer(EventPublisher publisher, EventsProperties properties) {
        this.publisher = publisher;
        this.properties = properties;
    }

    /** Kafka pe bhejna on hai? (DUAL/KAFKA mode) */
    public boolean enabled() {
        return properties.mode().producesEvents();
    }

    // ── Ek ek event bhejne wale methods (server ka time aur nayi event id lagti hai) ──

    /** Play event, bina listening detail ke. */
    public void play(String userId, String songId, double ratio, Long durationMs) {
        play(userId, songId, ratio, durationMs, ListenDetail.EMPTY);
    }

    /** Play event, listening detail ke saath. */
    public void play(String userId, String songId, double ratio, Long durationMs, ListenDetail detail) {
        sendPlay(userId, songId, ratio, durationMs, detail, serverMeta());
    }

    /** Skip event, bina position ke. */
    public void skip(String userId, String songId) {
        skip(userId, songId, null);
    }

    /** Skip event, position ke saath. */
    public void skip(String userId, String songId, Long positionMs) {
        sendSkip(userId, songId, positionMs, serverMeta());
    }

    /** Search interaction (play ya click). */
    public void search(String userId, SearchAction action, String entityType, String entityId) {
        sendSearch(userId, action, entityType, entityId, serverMeta());
    }

    /** Queue me song joda/hataya. */
    public void queue(String userId, String songId, QueueAction action) {
        sendQueue(userId, songId, action, serverMeta());
    }

    /** Dislike ya share. */
    public void feedback(String userId, String songId, FeedbackAction action) {
        sendFeedback(userId, songId, action, serverMeta());
    }

    /**
     * App ki queue se aaya poora batch.
     * Pehle SAARE events check karte hain (prepare), phir bhejte hain - taaki ek bhi galat event ho
     * to kuch bhi na jaaye, aur app poora batch theek karke dobara bhej sake.
     * Output: kitne events bheje.
     */
    public int batch(String userId, List<InteractionBatchRequestDto.Event> events) {
        if (events.size() > properties.maxBatchSize()) {
            throw new BadRequestException("At most " + properties.maxBatchSize() + " events per batch");
        }
        Instant now = Instant.now();
        List<Runnable> sends = events.stream().map(e -> prepare(userId, e, now)).toList();
        sends.forEach(Runnable::run);
        return sends.size();
    }

    /**
     * Ek batch event ko check karta hai aur "baad me bhejne wala kaam" (Runnable) lautata hai.
     * Event type ke hisaab se zaroori fields check hoti hain; unknown type pe 400.
     */
    private Runnable prepare(String userId, InteractionBatchRequestDto.Event e, Instant now) {
        EventMeta meta = clientMeta(e.eventId(), e.occurredAt(), now);
        String type = e.type().trim().toLowerCase(Locale.ROOT);
        return switch (type) {
            case "play" -> {
                requireSong(e.songId());
                double ratio = e.percentage() == null ? 0.0 : e.percentage();
                if (ratio < 0.0 || ratio > 1.0) throw new BadRequestException("percentage must be between 0 and 1");
                Long duration = e.durationMs() != null && e.durationMs() > 0 ? e.durationMs() : null;
                ListenDetail detail = ListenDetail.of(e.ranges(), e.exitMs(), e.skipped(), e.seeks(), e.quality(),
                        e.platform(), e.startupMs(), e.rebufferCount(), e.rebufferMs(), duration);
                yield () -> sendPlay(userId, e.songId(), ratio, duration, detail, meta);
            }
            case "skip" -> {
                requireSong(e.songId());
                if (e.positionMs() != null && e.positionMs() < 0) throw new BadRequestException("positionMs can't be negative");
                yield () -> sendSkip(userId, e.songId(), e.positionMs(), meta);
            }
            case "search-play" -> { requireSong(e.songId()); yield () -> sendSearch(userId, SearchAction.PLAY, "SONG", e.songId(), meta); }
            case "search-click" -> {
                requireId(e.entityId(), "entityId");
                String entityType = e.entityType() == null || e.entityType().isBlank() ? "SONG" : e.entityType().trim().toUpperCase(Locale.ROOT);
                requireId(entityType, "entityType");
                yield () -> sendSearch(userId, SearchAction.CLICK, entityType, e.entityId(), meta);
            }
            case "queue-add" -> { requireSong(e.songId()); yield () -> sendQueue(userId, e.songId(), QueueAction.ADD, meta); }
            case "queue-remove" -> { requireSong(e.songId()); yield () -> sendQueue(userId, e.songId(), QueueAction.REMOVE, meta); }
            case "dislike" -> { requireSong(e.songId()); yield () -> sendFeedback(userId, e.songId(), FeedbackAction.DISLIKE, meta); }
            case "share" -> { requireSong(e.songId()); yield () -> sendFeedback(userId, e.songId(), FeedbackAction.SHARE, meta); }
            default -> throw new BadRequestException("Unknown event type: " + e.type());
        };
    }

    // ── Asli Avro events banane aur bhejne wale methods ──

    /** PlayEvent -> listening.play.v1. ratio ko 0 se 1 ke beech rakhte hain. */
    private void sendPlay(String userId, String songId, double ratio, Long durationMs, ListenDetail d, EventMeta meta) {
        PlayEvent event = PlayEvent.newBuilder()
                .setMeta(meta).setUserId(userId).setSongId(songId)
                .setListenedRatio(Math.max(0.0, Math.min(1.0, ratio)))
                .setDurationMs(durationMs)
                .setRanges(d.ranges())
                .setExitMs(d.exitMs())
                .setSkipped(d.skipped())
                .setSeeks(d.seeks())
                .setQuality(d.quality())
                .setPlatform(d.platform())
                .setStartupMs(d.startupMs())
                .setRebufferCount(d.rebufferCount())
                .setRebufferMs(d.rebufferMs())
                .build();
        publisher.publish(Topics.PLAY, userId, event, meta.getOccurredAt());
    }

    /** SkipEvent -> listening.skip.v1 */
    private void sendSkip(String userId, String songId, Long positionMs, EventMeta meta) {
        SkipEvent event = SkipEvent.newBuilder().setMeta(meta).setUserId(userId).setSongId(songId)
                .setPositionMs(positionMs).build();
        publisher.publish(Topics.SKIP, userId, event, meta.getOccurredAt());
    }

    /** SearchInteraction -> search.interaction.v1 (login na ho to key "anonymous") */
    private void sendSearch(String userId, SearchAction action, String entityType, String entityId, EventMeta meta) {
        SearchInteraction event = SearchInteraction.newBuilder()
                .setMeta(meta).setUserId(userId).setAction(action)
                .setEntityType(entityType).setEntityId(entityId)
                .build();
        publisher.publish(Topics.SEARCH_INTERACTION, userId != null ? userId : ANONYMOUS, event, meta.getOccurredAt());
    }

    /** QueueChange -> queue.change.v1 */
    private void sendQueue(String userId, String songId, QueueAction action, EventMeta meta) {
        QueueChange event = QueueChange.newBuilder().setMeta(meta).setUserId(userId).setSongId(songId).setAction(action).build();
        publisher.publish(Topics.QUEUE_CHANGE, userId, event, meta.getOccurredAt());
    }

    /** SongFeedback (dislike/share) -> engagement.feedback.v1 */
    private void sendFeedback(String userId, String songId, FeedbackAction action, EventMeta meta) {
        SongFeedback event = SongFeedback.newBuilder().setMeta(meta).setUserId(userId).setSongId(songId).setAction(action).build();
        publisher.publish(Topics.FEEDBACK, userId, event, meta.getOccurredAt());
    }

    /** Server ki taraf se meta: nayi event id + abhi ka time. */
    private EventMeta serverMeta() {
        return EventIds.serverMeta(properties.source());
    }

    /**
     * App ki event id aur time rakhte hain (offline queue se events der se aate hain, asli time chahiye).
     * Par time "abhi" se 24 ghante se zyada door ho to reject - phone ki ghadi galat ho sakti hai.
     * Id na di ho to nayi bana lete hain; di ho to valid UUID honi chahiye.
     */
    EventMeta clientMeta(String eventId, Long occurredAtMs, Instant now) {
        String id = eventId == null || eventId.isBlank() ? EventIds.newId() : eventId.trim();
        if (!EventIds.isValid(id)) throw new BadRequestException("eventId must be a UUID");
        Instant occurredAt = occurredAtMs == null ? now : Instant.ofEpochMilli(occurredAtMs);
        long skew = Math.abs(occurredAt.toEpochMilli() - now.toEpochMilli());
        if (skew > properties.maxClockSkew().toMillis()) {
            throw new BadRequestException("occurredAt is too far from the server clock");
        }
        return EventIds.meta(id, occurredAt, now, properties.source());
    }

    /** songId zaroori hai. */
    private static void requireSong(String songId) {
        requireId(songId, "songId");
    }

    /** Value khaali ya bahut lambi (255+) na ho, warna 400. */
    private static void requireId(String value, String field) {
        if (value == null || value.isBlank() || value.length() > MAX_ID_LENGTH) {
            throw new BadRequestException(field + " is required");
        }
    }
}

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
 * Turns telemetry calls into Avro events. The user id always comes from the login
 * token, never from the request body, so a client can't send events as someone else.
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

    public boolean enabled() {
        return properties.mode().producesEvents();
    }

    public void play(String userId, String songId, double ratio, Long durationMs) {
        sendPlay(userId, songId, ratio, durationMs, serverMeta());
    }

    public void skip(String userId, String songId) {
        sendSkip(userId, songId, serverMeta());
    }

    public void search(String userId, SearchAction action, String entityType, String entityId) {
        sendSearch(userId, action, entityType, entityId, serverMeta());
    }

    public void queue(String userId, String songId, QueueAction action) {
        sendQueue(userId, songId, action, serverMeta());
    }

    public void feedback(String userId, String songId, FeedbackAction action) {
        sendFeedback(userId, songId, action, serverMeta());
    }

    /** Validates the whole batch first, so a bad event rejects the batch before anything is sent. */
    public int batch(String userId, List<InteractionBatchRequestDto.Event> events) {
        if (events.size() > properties.maxBatchSize()) {
            throw new BadRequestException("At most " + properties.maxBatchSize() + " events per batch");
        }
        Instant now = Instant.now();
        List<Runnable> sends = events.stream().map(e -> prepare(userId, e, now)).toList();
        sends.forEach(Runnable::run);
        return sends.size();
    }

    private Runnable prepare(String userId, InteractionBatchRequestDto.Event e, Instant now) {
        EventMeta meta = clientMeta(e.eventId(), e.occurredAt(), now);
        String type = e.type().trim().toLowerCase(Locale.ROOT);
        return switch (type) {
            case "play" -> {
                requireSong(e.songId());
                double ratio = e.percentage() == null ? 0.0 : e.percentage();
                if (ratio < 0.0 || ratio > 1.0) throw new BadRequestException("percentage must be between 0 and 1");
                Long duration = e.durationMs() != null && e.durationMs() > 0 ? e.durationMs() : null;
                yield () -> sendPlay(userId, e.songId(), ratio, duration, meta);
            }
            case "skip" -> { requireSong(e.songId()); yield () -> sendSkip(userId, e.songId(), meta); }
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

    private void sendPlay(String userId, String songId, double ratio, Long durationMs, EventMeta meta) {
        PlayEvent event = PlayEvent.newBuilder()
                .setMeta(meta).setUserId(userId).setSongId(songId)
                .setListenedRatio(Math.max(0.0, Math.min(1.0, ratio)))
                .setDurationMs(durationMs)
                .build();
        publisher.publish(Topics.PLAY, userId, event, meta.getOccurredAt());
    }

    private void sendSkip(String userId, String songId, EventMeta meta) {
        SkipEvent event = SkipEvent.newBuilder().setMeta(meta).setUserId(userId).setSongId(songId).build();
        publisher.publish(Topics.SKIP, userId, event, meta.getOccurredAt());
    }

    private void sendSearch(String userId, SearchAction action, String entityType, String entityId, EventMeta meta) {
        SearchInteraction event = SearchInteraction.newBuilder()
                .setMeta(meta).setUserId(userId).setAction(action)
                .setEntityType(entityType).setEntityId(entityId)
                .build();
        publisher.publish(Topics.SEARCH_INTERACTION, userId != null ? userId : ANONYMOUS, event, meta.getOccurredAt());
    }

    private void sendQueue(String userId, String songId, QueueAction action, EventMeta meta) {
        QueueChange event = QueueChange.newBuilder().setMeta(meta).setUserId(userId).setSongId(songId).setAction(action).build();
        publisher.publish(Topics.QUEUE_CHANGE, userId, event, meta.getOccurredAt());
    }

    private void sendFeedback(String userId, String songId, FeedbackAction action, EventMeta meta) {
        SongFeedback event = SongFeedback.newBuilder().setMeta(meta).setUserId(userId).setSongId(songId).setAction(action).build();
        publisher.publish(Topics.FEEDBACK, userId, event, meta.getOccurredAt());
    }

    private EventMeta serverMeta() {
        return EventIds.serverMeta(properties.source());
    }

    /** Keeps the client's id and clock when they're sane; rejects timestamps far off "now". */
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

    private static void requireSong(String songId) {
        requireId(songId, "songId");
    }

    private static void requireId(String value, String field) {
        if (value == null || value.isBlank() || value.length() > MAX_ID_LENGTH) {
            throw new BadRequestException(field + " is required");
        }
    }
}

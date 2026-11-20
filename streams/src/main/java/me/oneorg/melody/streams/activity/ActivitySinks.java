package me.oneorg.melody.streams.activity;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import lombok.extern.slf4j.Slf4j;
import me.oneorg.melody.events.PlayEvent;
import me.oneorg.melody.events.Topics;
import me.oneorg.melody.events.stats.ListeningSession;
import me.oneorg.melody.streams.config.PipelineProperties;
import me.oneorg.melody.streams.stats.StatsTopology;

/**
 * Postgres sinks for activityStreams.
 * <ul>
 *   <li>listening_sessions from activity.session.v1 (upsert; null = delete merged session).</li>
 *   <li>user_history from listening.play.v1, keyed on event_id so redelivery inserts nothing
 *       twice; for each newly inserted qualified play the song's total_streams and the
 *       user's history count go up by one in the same transaction. Off until the core API
 *       runs in KAFKA mode (melody.streams.history-sink-enabled), because before that the
 *       core API still writes history itself.</li>
 * </ul>
 */
@Component
@Profile("activity")
@Slf4j
public class ActivitySinks {

    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final PipelineProperties props;

    public ActivitySinks(JdbcTemplate jdbc, TransactionTemplate tx, PipelineProperties props) {
        this.jdbc = jdbc;
        this.tx = tx;
        this.props = props;
    }

    @KafkaListener(id = "activity-session-sink", topics = Topics.ACTIVITY_SESSION, containerFactory = "sessionSinkFactory")
    public void sessions(List<ConsumerRecord<String, ListeningSession>> records) {
        Map<String, ListeningSession> latest = new LinkedHashMap<>();
        for (ConsumerRecord<String, ListeningSession> r : records) {
            if (r.key() != null) latest.put(r.key(), r.value());
        }
        List<String> deletes = new ArrayList<>();
        List<ListeningSession> upserts = new ArrayList<>();
        latest.forEach((id, v) -> {
            if (v == null) deletes.add(id); else upserts.add(v);
        });
        tx.executeWithoutResult(status -> {
            if (!deletes.isEmpty()) {
                jdbc.batchUpdate("DELETE FROM listening_sessions WHERE id = ?", deletes, deletes.size(),
                        (ps, id) -> ps.setString(1, id));
            }
            if (!upserts.isEmpty()) {
                jdbc.batchUpdate("""
                        INSERT INTO listening_sessions (id, user_id, started_at, ended_at, plays, skips, listened_ms)
                        SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM users WHERE id = ?)
                        ON CONFLICT (id) DO UPDATE SET ended_at = EXCLUDED.ended_at, plays = EXCLUDED.plays,
                          skips = EXCLUDED.skips, listened_ms = EXCLUDED.listened_ms
                        """, upserts, upserts.size(), (ps, s) -> {
                    ps.setString(1, s.getSessionId());
                    ps.setString(2, s.getUserId());
                    ps.setTimestamp(3, Timestamp.from(s.getStartedAt()));
                    ps.setTimestamp(4, Timestamp.from(s.getEndedAt()));
                    ps.setInt(5, s.getPlays());
                    ps.setInt(6, s.getSkips());
                    ps.setLong(7, s.getListenedMs());
                    ps.setString(8, s.getUserId());
                });
            }
        });
    }

    @KafkaListener(id = "activity-history-sink", topics = Topics.PLAY, containerFactory = "historySinkFactory",
            autoStartup = "${melody.streams.history-sink-enabled:false}")
    public void history(List<ConsumerRecord<String, PlayEvent>> records) {
        if (!props.historySinkEnabled()) return;
        tx.executeWithoutResult(status -> writeHistory(records.stream().map(ConsumerRecord::value).filter(v -> v != null).toList()));
    }

    void writeHistory(List<PlayEvent> plays) {
        Map<String, Long> streamsBySong = new HashMap<>();
        Map<String, Long> historyByUser = new HashMap<>();
        for (PlayEvent e : plays) {
            double ratio = Math.max(0.0, Math.min(1.0, e.getListenedRatio()));
            int inserted = jdbc.update("""
                    INSERT INTO user_history (id, user_id, song_id, part, listened_at)
                    SELECT ?, ?, ?, ?, ?
                     WHERE EXISTS (SELECT 1 FROM users WHERE id = ?) AND EXISTS (SELECT 1 FROM songs WHERE id = ?)
                    ON CONFLICT (id) DO NOTHING
                    """, e.getMeta().getEventId(), e.getUserId(), e.getSongId(), (int) (ratio * 100),
                    Timestamp.from(e.getMeta().getOccurredAt()), e.getUserId(), e.getSongId());
            if (inserted == 0) continue;
            historyByUser.merge(e.getUserId(), 1L, Long::sum);
            if (StatsTopology.qualifies(ratio, e.getDurationMs())) {
                streamsBySong.merge(e.getSongId(), 1L, Long::sum);
            }
        }
        streamsBySong.forEach((songId, n) -> {
            int updated = jdbc.update("UPDATE song_metadata SET total_streams = total_streams + ?, updated_at = now() WHERE song_id = ?", n, songId);
            if (updated == 0) {
                jdbc.update("""
                        INSERT INTO song_metadata (id, song_id, total_streams) VALUES (gen_random_uuid()::text, ?, ?)
                        ON CONFLICT (song_id) DO UPDATE SET total_streams = song_metadata.total_streams + EXCLUDED.total_streams
                        """, songId, n);
            }
        });
        historyByUser.forEach((userId, n) -> {
            String entity = "UserHistory_" + userId;
            jdbc.update("""
                    INSERT INTO pagination_metadata (id, entity_name, total_count, active_count, blocked_count, deleted_count)
                    VALUES (gen_random_uuid()::text, ?, ?, ?, 0, 0)
                    ON CONFLICT (entity_name) DO UPDATE SET total_count = pagination_metadata.total_count + EXCLUDED.total_count,
                      active_count = pagination_metadata.active_count + EXCLUDED.active_count
                    """, entity, n, n);
        });
        if (!historyByUser.isEmpty()) {
            log.debug("user_history: {} new plays, {} songs counted", historyByUser.values().stream().mapToLong(Long::longValue).sum(), streamsBySong.size());
        }
    }
}

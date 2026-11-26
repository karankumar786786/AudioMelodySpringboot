package me.oneorg.melody.streams.analytics;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import me.oneorg.melody.events.Topics;
import me.oneorg.melody.events.analytics.SongDayStats;
import me.oneorg.melody.events.analytics.SongQualityStats;
import me.oneorg.melody.events.analytics.SongSecondStats;
import me.oneorg.melody.events.analytics.SongTimeline;

/**
 * Analytics topics ko V19 tables me likhta hai - har poll pe ek batched upsert.
 * Topology pehle hi updates ko window aur rate-limit karti hai (har key ka minute me ek record), aur values
 * running totals hain jo absolute likhe jaate hain (kabhi +1 nahi), isliye replay se double-count nahi hota.
 */
@Component
@Profile("analytics")
public class AnalyticsSink {

    private final JdbcTemplate jdbc;

    public AnalyticsSink(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** analytics.song-timeline.v1 -> song_timeline (har second ka upsert). */
    @KafkaListener(id = "analytics-sink-timeline", topics = Topics.ANALYTICS_SONG_TIMELINE, containerFactory = "analyticsSinkFactory")
    public void timeline(List<ConsumerRecord<String, SongTimeline>> records) {
        List<SongSecondStats> rows = latestSeconds(records);
        if (rows.isEmpty()) return;
        jdbc.batchUpdate("""
                INSERT INTO song_timeline (song_id, sec, listens, exits, skips, seeks_away, seeks_into)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (song_id, sec) DO UPDATE SET listens = EXCLUDED.listens, exits = EXCLUDED.exits,
                  skips = EXCLUDED.skips, seeks_away = EXCLUDED.seeks_away, seeks_into = EXCLUDED.seeks_into
                """, rows, rows.size(), (ps, r) -> {
            ps.setString(1, r.getSongId());
            ps.setInt(2, r.getSec());
            ps.setLong(3, r.getListens());
            ps.setLong(4, r.getExits());
            ps.setLong(5, r.getSkips());
            ps.setLong(6, r.getSeeksAway());
            ps.setLong(7, r.getSeeksInto());
        });
    }

    /** analytics.song-daily.v1 -> song_listen_daily (upsert). */
    @KafkaListener(id = "analytics-sink-daily", topics = Topics.ANALYTICS_SONG_DAILY, containerFactory = "analyticsSinkFactory")
    public void daily(List<ConsumerRecord<String, SongDayStats>> records) {
        List<SongDayStats> rows = latest(records);
        if (rows.isEmpty()) return;
        jdbc.batchUpdate("""
                INSERT INTO song_listen_daily (song_id, day, plays, qualified_streams, completions, skips, listened_ms)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (song_id, day) DO UPDATE SET plays = EXCLUDED.plays,
                  qualified_streams = EXCLUDED.qualified_streams, completions = EXCLUDED.completions,
                  skips = EXCLUDED.skips, listened_ms = EXCLUDED.listened_ms
                """, rows, rows.size(), (ps, r) -> {
            ps.setString(1, r.getSongId());
            ps.setObject(2, r.getDay());
            ps.setLong(3, r.getPlays());
            ps.setLong(4, r.getQualifiedStreams());
            ps.setLong(5, r.getCompletions());
            ps.setLong(6, r.getSkips());
            ps.setLong(7, r.getListenedMs());
        });
    }

    /** analytics.song-quality.v1 -> song_quality_daily (upsert). */
    @KafkaListener(id = "analytics-sink-quality", topics = Topics.ANALYTICS_SONG_QUALITY, containerFactory = "analyticsSinkFactory")
    public void quality(List<ConsumerRecord<String, SongQualityStats>> records) {
        List<SongQualityStats> rows = latest(records);
        if (rows.isEmpty()) return;
        jdbc.batchUpdate("""
                INSERT INTO song_quality_daily (song_id, day, quality, platform, plays, listened_ms, startup_ms_sum,
                                                startup_samples, rebuffer_count, rebuffer_ms)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (song_id, day, quality, platform) DO UPDATE SET plays = EXCLUDED.plays,
                  listened_ms = EXCLUDED.listened_ms, startup_ms_sum = EXCLUDED.startup_ms_sum,
                  startup_samples = EXCLUDED.startup_samples, rebuffer_count = EXCLUDED.rebuffer_count,
                  rebuffer_ms = EXCLUDED.rebuffer_ms
                """, rows, rows.size(), (ps, r) -> {
            ps.setString(1, r.getSongId());
            ps.setObject(2, r.getDay());
            ps.setString(3, r.getQuality());
            ps.setString(4, r.getPlatform());
            ps.setLong(5, r.getPlays());
            ps.setLong(6, r.getListenedMs());
            ps.setLong(7, r.getStartupMsSum());
            ps.setLong(8, r.getStartupSamples());
            ps.setLong(9, r.getRebufferCount());
            ps.setLong(10, r.getRebufferMs());
        });
    }

    /**
     * Har record me ek window ne jo seconds badle unke running totals hain; sabko flat karo aur har second
     * ka sabse naya total rakho (ek song ke records ek hi partition pe, order me aate hain).
     */
    static List<SongSecondStats> latestSeconds(List<ConsumerRecord<String, SongTimeline>> records) {
        Map<String, SongSecondStats> bySecond = new LinkedHashMap<>();
        for (ConsumerRecord<String, SongTimeline> r : records) {
            if (r.value() == null) continue;
            for (SongSecondStats sec : r.value().getSeconds()) {
                if (sec != null) bySecond.put(sec.getSongId() + "|" + sec.getSec(), sec);
            }
        }
        return List.copyOf(bySecond.values());
    }

    /** Batch me har key ki sabse nayi value. */
    static <V> List<V> latest(List<ConsumerRecord<String, V>> records) {
        Map<String, V> byKey = new LinkedHashMap<>();
        for (ConsumerRecord<String, V> r : records) {
            if (r.key() != null && r.value() != null) byKey.put(r.key(), r.value());
        }
        return List.copyOf(byKey.values());
    }
}

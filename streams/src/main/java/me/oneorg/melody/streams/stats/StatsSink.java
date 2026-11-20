package me.oneorg.melody.streams.stats;

import java.sql.Timestamp;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;
import me.oneorg.melody.events.Topics;
import me.oneorg.melody.events.stats.ArtistStats;
import me.oneorg.melody.events.stats.SongDailyStats;
import me.oneorg.melody.events.stats.SongStats;

/**
 * Writes the stats topics into Postgres. Values are totals, written as absolute values,
 * so a replay or a redelivered batch can't double-count. Only the newest record per key
 * in each batch is written.
 */
@Component
@Profile("stats")
@Slf4j
public class StatsSink {

    private final JdbcTemplate jdbc;

    public StatsSink(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @KafkaListener(id = "stats-sink-song", topics = Topics.STATS_SONG, containerFactory = "statsSinkFactory")
    public void songs(List<ConsumerRecord<String, SongStats>> records) {
        List<SongStats> latest = latest(records);
        if (latest.isEmpty()) return;
        jdbc.batchUpdate("""
                INSERT INTO song_stats (song_id, plays, qualified_streams, listened_ratio_sum, skips, favourites, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (song_id) DO UPDATE SET
                  plays = EXCLUDED.plays, qualified_streams = EXCLUDED.qualified_streams,
                  listened_ratio_sum = EXCLUDED.listened_ratio_sum, skips = EXCLUDED.skips,
                  favourites = EXCLUDED.favourites, updated_at = EXCLUDED.updated_at
                """, latest, latest.size(), (ps, s) -> {
            ps.setString(1, s.getSongId());
            ps.setLong(2, s.getPlays());
            ps.setLong(3, s.getQualifiedStreams());
            ps.setDouble(4, s.getListenedRatioSum());
            ps.setLong(5, s.getSkips());
            ps.setLong(6, s.getFavourites());
            ps.setTimestamp(7, Timestamp.from(s.getUpdatedAt()));
        });
        log.debug("song_stats: wrote {} songs", latest.size());
    }

    @KafkaListener(id = "stats-sink-song-daily", topics = Topics.STATS_SONG_DAILY, containerFactory = "statsSinkFactory")
    public void daily(List<ConsumerRecord<String, SongDailyStats>> records) {
        List<SongDailyStats> latest = latest(records);
        if (latest.isEmpty()) return;
        jdbc.batchUpdate("""
                INSERT INTO song_daily_stats (song_id, day, plays, qualified_streams, skips, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT (song_id, day) DO UPDATE SET
                  plays = EXCLUDED.plays, qualified_streams = EXCLUDED.qualified_streams,
                  skips = EXCLUDED.skips, updated_at = EXCLUDED.updated_at
                """, latest, latest.size(), (ps, s) -> {
            ps.setString(1, s.getSongId());
            ps.setObject(2, s.getDay());
            ps.setLong(3, s.getPlays());
            ps.setLong(4, s.getQualifiedStreams());
            ps.setLong(5, s.getSkips());
            ps.setTimestamp(6, Timestamp.from(s.getUpdatedAt()));
        });
    }

    @KafkaListener(id = "stats-sink-artist", topics = Topics.STATS_ARTIST, containerFactory = "statsSinkFactory")
    public void artists(List<ConsumerRecord<String, ArtistStats>> records) {
        List<ArtistStats> latest = latest(records);
        if (latest.isEmpty()) return;
        jdbc.batchUpdate("""
                INSERT INTO artist_stats (artist_id, follows_gained, follows_lost, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT (artist_id) DO UPDATE SET
                  follows_gained = EXCLUDED.follows_gained, follows_lost = EXCLUDED.follows_lost,
                  updated_at = EXCLUDED.updated_at
                """, latest, latest.size(), (ps, s) -> {
            ps.setString(1, s.getArtistId());
            ps.setLong(2, s.getFollowsGained());
            ps.setLong(3, s.getFollowsLost());
            ps.setTimestamp(4, Timestamp.from(s.getUpdatedAt()));
        });
    }

    static <V> List<V> latest(List<ConsumerRecord<String, V>> records) {
        Map<String, V> byKey = new LinkedHashMap<>();
        for (ConsumerRecord<String, V> r : records) {
            if (r.key() == null) continue;
            if (r.value() == null) byKey.remove(r.key());
            else byKey.put(r.key(), r.value());
        }
        return List.copyOf(byKey.values());
    }
}

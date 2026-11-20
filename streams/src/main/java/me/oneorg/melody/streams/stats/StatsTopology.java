package me.oneorg.melody.streams.stats;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

import org.apache.kafka.common.serialization.Serde;
import org.apache.kafka.common.serialization.Serdes;
import org.apache.kafka.common.utils.Bytes;
import org.apache.kafka.streams.KeyValue;
import org.apache.kafka.streams.StreamsBuilder;
import org.apache.kafka.streams.kstream.Consumed;
import org.apache.kafka.streams.kstream.Grouped;
import org.apache.kafka.streams.kstream.KStream;
import org.apache.kafka.streams.kstream.Materialized;
import org.apache.kafka.streams.kstream.Produced;
import org.apache.kafka.streams.kstream.TimeWindows;
import org.apache.kafka.streams.kstream.Windowed;
import org.apache.kafka.streams.state.KeyValueStore;
import org.apache.kafka.streams.state.WindowStore;

import me.oneorg.melody.events.ArtistFollowChanged;
import me.oneorg.melody.events.FavouriteChanged;
import me.oneorg.melody.events.PlayEvent;
import me.oneorg.melody.events.SkipEvent;
import me.oneorg.melody.events.Topics;
import me.oneorg.melody.events.stats.ArtistStats;
import me.oneorg.melody.events.stats.SongDailyStats;
import me.oneorg.melody.events.stats.SongStatDelta;
import me.oneorg.melody.events.stats.SongStats;
import me.oneorg.melody.streams.config.Dedupe;

/**
 * statsStreams: running totals per song and artist, and per-song daily windows.
 *
 *   plays, skips, favourites --dedupe--> SongStatDelta keyed by song --> totals  --> stats.song.v1
 *                                                                    \-> 1-day windows --> stats.song-daily.v1
 *   follows --dedupe--> keyed by artist --> totals --> stats.artist.v1
 */
public final class StatsTopology {

    /** A play counts as a stream after 30 s, or half of a track shorter than 30 s (the legacy rule). */
    public static boolean qualifies(double ratio, Long durationMs) {
        long duration = durationMs != null && durationMs > 0 ? durationMs : 180_000L;
        double listenedMs = ratio * duration;
        return listenedMs >= 30_000 || (duration < 30_000 && ratio >= 0.5);
    }

    public record Serdes4(Serde<PlayEvent> play, Serde<SkipEvent> skip, Serde<FavouriteChanged> favourite,
                          Serde<ArtistFollowChanged> follow, Serde<SongStatDelta> delta, Serde<SongStats> songStats,
                          Serde<SongDailyStats> daily, Serde<ArtistStats> artistStats) {}

    private StatsTopology() {}

    public static void build(StreamsBuilder builder, Serdes4 s) {
        Serde<String> str = Serdes.String();
        Dedupe.addStore(builder, "stats-seen-plays");
        Dedupe.addStore(builder, "stats-seen-skips");
        Dedupe.addStore(builder, "stats-seen-favourites");
        Dedupe.addStore(builder, "stats-seen-follows");

        KStream<String, SongStatDelta> plays = builder.stream(Topics.PLAY, Consumed.with(str, s.play()))
                .processValues(Dedupe.<PlayEvent>byEventId("stats-seen-plays", e -> e.getMeta().getEventId()), "stats-seen-plays")
                .map((k, e) -> KeyValue.pair(e.getSongId(), SongStatDelta.newBuilder()
                        .setSongId(e.getSongId())
                        .setPlays(1)
                        .setQualifiedStreams(qualifies(e.getListenedRatio(), e.getDurationMs()) ? 1 : 0)
                        .setListenedRatioSum(e.getListenedRatio())
                        .build()));

        KStream<String, SongStatDelta> skips = builder.stream(Topics.SKIP, Consumed.with(str, s.skip()))
                .processValues(Dedupe.<SkipEvent>byEventId("stats-seen-skips", e -> e.getMeta().getEventId()), "stats-seen-skips")
                .map((k, e) -> KeyValue.pair(e.getSongId(), SongStatDelta.newBuilder().setSongId(e.getSongId()).setSkips(1).build()));

        KStream<String, SongStatDelta> favourites = builder.stream(Topics.FAVOURITE, Consumed.with(str, s.favourite()))
                .processValues(Dedupe.<FavouriteChanged>byEventId("stats-seen-favourites", e -> e.getMeta().getEventId()), "stats-seen-favourites")
                .map((k, e) -> KeyValue.pair(e.getSongId(), SongStatDelta.newBuilder()
                        .setSongId(e.getSongId()).setFavourites(e.getAdded() ? 1 : -1).build()));

        KStream<String, SongStatDelta> deltas = plays.merge(skips).merge(favourites);

        deltas.groupByKey(Grouped.with("stats-by-song", str, s.delta()))
                .aggregate(
                        () -> null,
                        (songId, d, total) -> add(total, d),
                        Materialized.<String, SongStats, KeyValueStore<Bytes, byte[]>>as("song-stats").withKeySerde(str).withValueSerde(s.songStats()))
                .toStream()
                .to(Topics.STATS_SONG, Produced.with(str, s.songStats()));

        deltas.filter((songId, d) -> d.getPlays() > 0 || d.getSkips() > 0)
                .groupByKey(Grouped.with("stats-by-song-daily", str, s.delta()))
                .windowedBy(TimeWindows.ofSizeAndGrace(Duration.ofDays(1), Duration.ofHours(6)))
                .aggregate(
                        () -> null,
                        (songId, d, day) -> addDaily(day, d),
                        Materialized.<String, SongDailyStats, WindowStore<Bytes, byte[]>>as("song-daily-stats")
                                .withKeySerde(str).withValueSerde(s.daily()).withRetention(Duration.ofDays(3)))
                .toStream()
                .map((Windowed<String> w, SongDailyStats v) -> {
                    LocalDate day = Instant.ofEpochMilli(w.window().start()).atZone(ZoneOffset.UTC).toLocalDate();
                    SongDailyStats out = SongDailyStats.newBuilder(v).setSongId(w.key()).setDay(day).build();
                    return KeyValue.pair(w.key() + "|" + day, out);
                })
                .to(Topics.STATS_SONG_DAILY, Produced.with(str, s.daily()));

        builder.stream(Topics.ARTIST_FOLLOW, Consumed.with(str, s.follow()))
                .processValues(Dedupe.<ArtistFollowChanged>byEventId("stats-seen-follows", e -> e.getMeta().getEventId()), "stats-seen-follows")
                .selectKey((k, e) -> e.getArtistId())
                .groupByKey(Grouped.with("stats-by-artist", str, s.follow()))
                .aggregate(
                        () -> null,
                        (artistId, e, total) -> ArtistStats.newBuilder()
                                .setArtistId(artistId)
                                .setFollowsGained((total == null ? 0 : total.getFollowsGained()) + (e.getFollowed() ? 1 : 0))
                                .setFollowsLost((total == null ? 0 : total.getFollowsLost()) + (e.getFollowed() ? 0 : 1))
                                .setUpdatedAt(Instant.now())
                                .build(),
                        Materialized.<String, ArtistStats, KeyValueStore<Bytes, byte[]>>as("artist-stats").withKeySerde(str).withValueSerde(s.artistStats()))
                .toStream()
                .to(Topics.STATS_ARTIST, Produced.with(str, s.artistStats()));
    }

    static SongStats add(SongStats total, SongStatDelta d) {
        SongStats.Builder b = total == null
                ? SongStats.newBuilder().setSongId(d.getSongId())
                : SongStats.newBuilder(total);
        return b.setPlays(b.getPlays() + d.getPlays())
                .setQualifiedStreams(b.getQualifiedStreams() + d.getQualifiedStreams())
                .setListenedRatioSum(b.getListenedRatioSum() + d.getListenedRatioSum())
                .setSkips(b.getSkips() + d.getSkips())
                .setFavourites(b.getFavourites() + d.getFavourites())
                .setUpdatedAt(Instant.now())
                .build();
    }

    static SongDailyStats addDaily(SongDailyStats day, SongStatDelta d) {
        SongDailyStats.Builder b = day == null
                ? SongDailyStats.newBuilder().setSongId(d.getSongId()).setDay(LocalDate.EPOCH)
                : SongDailyStats.newBuilder(day);
        return b.setPlays(b.getPlays() + d.getPlays())
                .setQualifiedStreams(b.getQualifiedStreams() + d.getQualifiedStreams())
                .setSkips(b.getSkips() + d.getSkips())
                .setUpdatedAt(Instant.now())
                .build();
    }
}

package me.oneorg.melody.streams.analytics;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;

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
import org.apache.kafka.streams.state.KeyValueStore;

import me.oneorg.melody.events.ListenRange;
import me.oneorg.melody.events.PlayEvent;
import me.oneorg.melody.events.SeekMove;
import me.oneorg.melody.events.SkipEvent;
import me.oneorg.melody.events.Topics;
import me.oneorg.melody.events.analytics.SongDayStats;
import me.oneorg.melody.events.analytics.SongQualityStats;
import me.oneorg.melody.events.analytics.SongSecondStats;
import me.oneorg.melody.streams.config.Dedupe;
import me.oneorg.melody.streams.stats.StatsTopology;

/**
 * Song analytics for the admin dashboard.
 *
 *   plays --dedupe--> per-second deltas (listens, exits, skips, seeks)  --sum--> analytics.song-timeline.v1
 *         \--------> per-day deltas (plays, streams, completions, ms) --sum--> analytics.song-daily.v1
 *          \-------> per-day/quality/platform delivery deltas       --sum--> analytics.song-quality.v1
 *   skips --dedupe--> per-day skip deltas ------------------------------^
 *
 * Only plays that report the parts listened ("ranges") feed the heatmap; older clients
 * still count in the daily totals.
 */
public final class AnalyticsTopology {

    /** No play contributes more than an hour of seconds, whatever it claims. */
    static final int MAX_SECONDS_PER_PLAY = 3600;
    static final double COMPLETION_RATIO = 0.9;

    public record Serdes5(Serde<PlayEvent> play, Serde<SkipEvent> skip, Serde<SongSecondStats> second,
                          Serde<SongDayStats> day, Serde<SongQualityStats> quality) {}

    private AnalyticsTopology() {}

    public static void build(StreamsBuilder builder, Serdes5 s) {
        Serde<String> str = Serdes.String();
        Dedupe.addStore(builder, "analytics-seen-plays");
        Dedupe.addStore(builder, "analytics-seen-skips");

        KStream<String, PlayEvent> plays = builder.stream(Topics.PLAY, Consumed.with(str, s.play()))
                .processValues(Dedupe.<PlayEvent>byEventId("analytics-seen-plays", e -> e.getMeta().getEventId()), "analytics-seen-plays");
        KStream<String, SkipEvent> skips = builder.stream(Topics.SKIP, Consumed.with(str, s.skip()))
                .processValues(Dedupe.<SkipEvent>byEventId("analytics-seen-skips", e -> e.getMeta().getEventId()), "analytics-seen-skips");

        // 1. Per-second timeline.
        plays.flatMap((k, e) -> secondDeltas(e).entrySet().stream()
                        .map(en -> KeyValue.pair(e.getSongId() + "|" + en.getKey(), en.getValue()))
                        .toList())
                .groupByKey(Grouped.with("analytics-by-second", str, s.second()))
                .reduce(AnalyticsTopology::sum,
                        Materialized.<String, SongSecondStats, KeyValueStore<Bytes, byte[]>>as("song-timeline")
                                .withKeySerde(str).withValueSerde(s.second()))
                .toStream()
                .to(Topics.ANALYTICS_SONG_TIMELINE, Produced.with(str, s.second()));

        // 2. Daily totals (plays and skips).
        KStream<String, SongDayStats> playDays = plays.map((k, e) -> {
            SongDayStats d = playDay(e);
            return KeyValue.pair(e.getSongId() + "|" + d.getDay(), d);
        });
        KStream<String, SongDayStats> skipDays = skips.map((k, e) -> {
            LocalDate day = LocalDate.ofInstant(e.getMeta().getOccurredAt(), ZoneOffset.UTC);
            SongDayStats d = SongDayStats.newBuilder().setSongId(e.getSongId()).setDay(day).setSkips(1).build();
            return KeyValue.pair(e.getSongId() + "|" + day, d);
        });
        playDays.merge(skipDays)
                .groupByKey(Grouped.with("analytics-by-day", str, s.day()))
                .reduce(AnalyticsTopology::sum,
                        Materialized.<String, SongDayStats, KeyValueStore<Bytes, byte[]>>as("song-listen-daily")
                                .withKeySerde(str).withValueSerde(s.day()))
                .toStream()
                .to(Topics.ANALYTICS_SONG_DAILY, Produced.with(str, s.day()));

        // 3. Delivery quality per day, quality and platform.
        plays.map((k, e) -> {
                    SongQualityStats q = qualityDelta(e);
                    return KeyValue.pair(e.getSongId() + "|" + q.getDay() + "|" + q.getQuality() + "|" + q.getPlatform(), q);
                })
                .groupByKey(Grouped.with("analytics-by-quality", str, s.quality()))
                .reduce(AnalyticsTopology::sum,
                        Materialized.<String, SongQualityStats, KeyValueStore<Bytes, byte[]>>as("song-quality-daily")
                                .withKeySerde(str).withValueSerde(s.quality()))
                .toStream()
                .to(Topics.ANALYTICS_SONG_QUALITY, Produced.with(str, s.quality()));
    }

    // ---- Pure mapping, unit-tested -----------------------------------------------------------

    /** One play's contribution to each second it touched, keyed by second. */
    public static Map<Integer, SongSecondStats> secondDeltas(PlayEvent e) {
        Map<Integer, long[]> acc = new LinkedHashMap<>(); // [listens, exits, skips, away, into]
        int budget = MAX_SECONDS_PER_PLAY;
        for (ListenRange r : e.getRanges()) {
            int from = (int) (r.getStartMs() / 1000);
            int to = (int) ((r.getEndMs() - 1) / 1000); // last second actually reached
            for (int sec = from; sec <= to && budget > 0; sec++, budget--) {
                acc.computeIfAbsent(sec, x -> new long[5])[0]++;
            }
        }
        Long exit = e.getExitMs();
        if (exit == null && !e.getRanges().isEmpty()) exit = e.getRanges().get(e.getRanges().size() - 1).getEndMs();
        if (exit != null && !e.getRanges().isEmpty()) {
            int sec = (int) (Math.max(0, exit - 1) / 1000);
            long[] v = acc.computeIfAbsent(sec, x -> new long[5]);
            v[1]++;
            if (e.getSkipped()) v[2]++;
        }
        for (SeekMove m : e.getSeeks()) {
            acc.computeIfAbsent((int) (m.getFromMs() / 1000), x -> new long[5])[3]++;
            acc.computeIfAbsent((int) (m.getToMs() / 1000), x -> new long[5])[4]++;
        }
        Map<Integer, SongSecondStats> out = new LinkedHashMap<>();
        acc.forEach((sec, v) -> out.put(sec, SongSecondStats.newBuilder()
                .setSongId(e.getSongId()).setSec(sec)
                .setListens(v[0]).setExits(v[1]).setSkips(v[2]).setSeeksAway(v[3]).setSeeksInto(v[4])
                .build()));
        return out;
    }

    /** Milliseconds actually heard: the ranges if sent, else ratio × duration. */
    public static long listenedMs(PlayEvent e) {
        if (!e.getRanges().isEmpty()) {
            return e.getRanges().stream().mapToLong(r -> r.getEndMs() - r.getStartMs()).sum();
        }
        long duration = e.getDurationMs() != null && e.getDurationMs() > 0 ? e.getDurationMs() : 180_000L;
        return Math.round(e.getListenedRatio() * duration);
    }

    public static SongDayStats playDay(PlayEvent e) {
        LocalDate day = LocalDate.ofInstant(e.getMeta().getOccurredAt(), ZoneOffset.UTC);
        return SongDayStats.newBuilder()
                .setSongId(e.getSongId()).setDay(day)
                .setPlays(1)
                .setQualifiedStreams(StatsTopology.qualifies(e.getListenedRatio(), e.getDurationMs()) ? 1 : 0)
                .setCompletions(e.getListenedRatio() >= COMPLETION_RATIO ? 1 : 0)
                .setListenedMs(listenedMs(e))
                .build();
    }

    public static SongQualityStats qualityDelta(PlayEvent e) {
        LocalDate day = LocalDate.ofInstant(e.getMeta().getOccurredAt(), ZoneOffset.UTC);
        return SongQualityStats.newBuilder()
                .setSongId(e.getSongId()).setDay(day)
                .setQuality(e.getQuality() == null ? "unknown" : e.getQuality())
                .setPlatform(e.getPlatform() == null ? "unknown" : e.getPlatform())
                .setPlays(1)
                .setListenedMs(listenedMs(e))
                .setStartupMsSum(e.getStartupMs() == null ? 0 : e.getStartupMs())
                .setStartupSamples(e.getStartupMs() == null ? 0 : 1)
                .setRebufferCount(e.getRebufferCount())
                .setRebufferMs(e.getRebufferMs())
                .build();
    }

    static SongSecondStats sum(SongSecondStats a, SongSecondStats b) {
        return SongSecondStats.newBuilder(a)
                .setListens(a.getListens() + b.getListens())
                .setExits(a.getExits() + b.getExits())
                .setSkips(a.getSkips() + b.getSkips())
                .setSeeksAway(a.getSeeksAway() + b.getSeeksAway())
                .setSeeksInto(a.getSeeksInto() + b.getSeeksInto())
                .build();
    }

    static SongDayStats sum(SongDayStats a, SongDayStats b) {
        return SongDayStats.newBuilder(a)
                .setPlays(a.getPlays() + b.getPlays())
                .setQualifiedStreams(a.getQualifiedStreams() + b.getQualifiedStreams())
                .setCompletions(a.getCompletions() + b.getCompletions())
                .setSkips(a.getSkips() + b.getSkips())
                .setListenedMs(a.getListenedMs() + b.getListenedMs())
                .build();
    }

    static SongQualityStats sum(SongQualityStats a, SongQualityStats b) {
        return SongQualityStats.newBuilder(a)
                .setPlays(a.getPlays() + b.getPlays())
                .setListenedMs(a.getListenedMs() + b.getListenedMs())
                .setStartupMsSum(a.getStartupMsSum() + b.getStartupMsSum())
                .setStartupSamples(a.getStartupSamples() + b.getStartupSamples())
                .setRebufferCount(a.getRebufferCount() + b.getRebufferCount())
                .setRebufferMs(a.getRebufferMs() + b.getRebufferMs())
                .build();
    }

}

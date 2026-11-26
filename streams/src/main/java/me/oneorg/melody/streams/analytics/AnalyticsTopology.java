package me.oneorg.melody.streams.analytics;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

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
import org.apache.kafka.streams.kstream.Suppressed;
import org.apache.kafka.streams.kstream.TimeWindows;
import org.apache.kafka.streams.kstream.Windowed;
import org.apache.kafka.streams.processor.api.FixedKeyProcessor;
import org.apache.kafka.streams.processor.api.FixedKeyProcessorContext;
import org.apache.kafka.streams.processor.api.FixedKeyProcessorSupplier;
import org.apache.kafka.streams.processor.api.FixedKeyRecord;
import org.apache.kafka.streams.state.KeyValueStore;
import org.apache.kafka.streams.state.Stores;
import org.apache.kafka.streams.state.WindowStore;

import me.oneorg.melody.events.ListenRange;
import me.oneorg.melody.events.PlayEvent;
import me.oneorg.melody.events.SeekMove;
import me.oneorg.melody.events.SkipEvent;
import me.oneorg.melody.events.Topics;
import me.oneorg.melody.events.analytics.SongDayStats;
import me.oneorg.melody.events.analytics.SongQualityStats;
import me.oneorg.melody.events.analytics.SongSecondStats;
import me.oneorg.melody.events.analytics.SongTimeline;
import me.oneorg.melody.streams.config.Dedupe;
import me.oneorg.melody.streams.stats.StatsTopology;

/**
 * Admin dashboard ke song analytics. Har branch apne updates ko group aur window karti hai, to sink (aur Postgres)
 * ko har play pe nahi, har key ka minute me ek record milta hai.
 *
 *   plays --dedupe--> pahunchne ka time --groupBy song--> 1-min window: per-second deltas jodo
 *         --> window band ho tab bhejo --> song ke totals me jodo --> badle hue seconds
 *         (running totals) --> analytics.song-timeline.v1
 *   plays + skips --groupBy song--> 1-din window (UTC) --> minute me max ek update --> analytics.song-daily.v1
 *   plays --groupBy song|quality|platform--> 1-din window --> minute me max ek        --> analytics.song-quality.v1
 *
 * Heatmap me sirf wo plays aate hain jo "ranges" (kaunse hisse sune) bhejte hain; purane apps ke plays
 * daily totals me phir bhi ginte hain. Suppression "stream time" pe chalta hai, isliye shaant partition pe
 * aakhri minute tab likha jaata hai jab agla event aaye.
 */
public final class AnalyticsTopology {

    /** Ek play ek ghante se zyada seconds nahi jod sakta, client kuch bhi bheje. */
    static final int MAX_SECONDS_PER_PLAY = 3600;
    static final double COMPLETION_RATIO = 0.9;

    /** Heatmap ke deltas is window me har song ke liye jode jaate hain, phir totals me ek hi baar. */
    static final Duration TIMELINE_WINDOW = Duration.ofMinutes(1);
    static final Duration TIMELINE_GRACE = Duration.ofSeconds(10);
    /** Daily windows 24 ghante (core API ki max clock skew) tak der se aaye events bhi le lete hain. */
    static final Duration DAY_GRACE = Duration.ofHours(25);
    /** Daily totals har key ke liye max itni baar bheje jaate hain. */
    static final Duration EMIT_EVERY = Duration.ofMinutes(1);
    static final long MAX_BUFFERED = 20_000;

    static final String TIMELINE_TOTALS = "song-timeline-totals";

    /** Topology ke liye zaroori serdes. */
    public record AnalyticsSerdes(Serde<PlayEvent> play, Serde<SkipEvent> skip, Serde<SongTimeline> timeline,
                                  Serde<SongDayStats> day, Serde<SongQualityStats> quality) {}

    private AnalyticsTopology() {}

    /** Teeno branches wali topology banao (diagram upar). */
    public static void build(StreamsBuilder builder, AnalyticsSerdes s) {
        Serde<String> str = Serdes.String();
        Dedupe.addStore(builder, "analytics-seen-plays");
        Dedupe.addStore(builder, "analytics-seen-skips");
        builder.addStateStore(Stores.keyValueStoreBuilder(
                Stores.persistentKeyValueStore(TIMELINE_TOTALS), str, s.timeline()));

        KStream<String, PlayEvent> plays = builder.stream(Topics.PLAY, Consumed.with(str, s.play()))
                .processValues(Dedupe.<PlayEvent>byEventId("analytics-seen-plays", e -> e.getMeta().getEventId()), "analytics-seen-plays");
        KStream<String, SkipEvent> skips = builder.stream(Topics.SKIP, Consumed.with(str, s.skip()))
                .processValues(Dedupe.<SkipEvent>byEventId("analytics-seen-skips", e -> e.getMeta().getEventId()), "analytics-seen-skips");

        // 1. Har second ki timeline. Heatmap din ke hisaab se nahi bata, isliye window "pahunchne ke time" pe hai:
        // offline phone se der se aaya play bhi khuli window me aa jaata hai.
        plays.filter((k, e) -> !e.getRanges().isEmpty() || !e.getSeeks().isEmpty())
                .processValues(AnalyticsTopology::arrivalTime)
                .mapValues(AnalyticsTopology::timelineDelta)
                .groupBy((k, t) -> t.getSongId(), Grouped.with("analytics-timeline-by-song", str, s.timeline()))
                .windowedBy(TimeWindows.ofSizeAndGrace(TIMELINE_WINDOW, TIMELINE_GRACE))
                .reduce(AnalyticsTopology::sum,
                        Materialized.<String, SongTimeline, WindowStore<Bytes, byte[]>>as("song-timeline-minute")
                                .withKeySerde(str).withValueSerde(s.timeline())
                                .withRetention(TIMELINE_WINDOW.plus(TIMELINE_GRACE).multipliedBy(2)))
                .suppress(Suppressed.untilWindowCloses(Suppressed.BufferConfig.unbounded()).withName("song-timeline-closed"))
                .toStream()
                .selectKey((w, t) -> w.key())
                .processValues(addToTotals(), TIMELINE_TOTALS)
                .to(Topics.ANALYTICS_SONG_TIMELINE, Produced.with(str, s.timeline()));

        // 2. Daily totals (plays aur skips), har song ki ek UTC-din window.
        KStream<String, SongDayStats> playDays = plays.mapValues(AnalyticsTopology::playDay);
        KStream<String, SongDayStats> skipDays = skips.mapValues(e -> SongDayStats.newBuilder()
                .setSongId(e.getSongId()).setDay(utcDay(e.getMeta().getOccurredAt())).setSkips(1).build());
        playDays.merge(skipDays)
                .groupBy((k, d) -> d.getSongId(), Grouped.with("analytics-daily-by-song", str, s.day()))
                .windowedBy(TimeWindows.ofSizeAndGrace(Duration.ofDays(1), DAY_GRACE))
                .reduce(AnalyticsTopology::sum,
                        Materialized.<String, SongDayStats, WindowStore<Bytes, byte[]>>as("song-listen-daily")
                                .withKeySerde(str).withValueSerde(s.day()).withRetention(Duration.ofDays(3)))
                .suppress(rateLimited("song-listen-daily-emit"))
                .toStream()
                .map((w, d) -> {
                    LocalDate day = windowDay(w);
                    return KeyValue.pair(w.key() + "|" + day, SongDayStats.newBuilder(d).setDay(day).build());
                })
                .to(Topics.ANALYTICS_SONG_DAILY, Produced.with(str, s.day()));

        // 3. Streaming quality - har din, quality aur platform ke hisaab se.
        plays.mapValues(AnalyticsTopology::qualityDelta)
                .groupBy((k, q) -> q.getSongId() + "|" + q.getQuality() + "|" + q.getPlatform(),
                        Grouped.with("analytics-quality-by-song", str, s.quality()))
                .windowedBy(TimeWindows.ofSizeAndGrace(Duration.ofDays(1), DAY_GRACE))
                .reduce(AnalyticsTopology::sum,
                        Materialized.<String, SongQualityStats, WindowStore<Bytes, byte[]>>as("song-quality-daily")
                                .withKeySerde(str).withValueSerde(s.quality()).withRetention(Duration.ofDays(3)))
                .suppress(rateLimited("song-quality-daily-emit"))
                .toStream()
                .map((w, q) -> {
                    LocalDate day = windowDay(w);
                    SongQualityStats out = SongQualityStats.newBuilder(q).setDay(day).build();
                    return KeyValue.pair(out.getSongId() + "|" + day + "|" + out.getQuality() + "|" + out.getPlatform(), out);
                })
                .to(Topics.ANALYTICS_SONG_QUALITY, Produced.with(str, s.quality()));
    }

    /** Har key ki sabse nayi value minute me max ek baar; buffer bhar jaaye to fail hone ke bajaye jaldi bhej do. */
    private static <K, V> Suppressed<Windowed<K>> rateLimited(String name) {
        return Suppressed.<Windowed<K>>untilTimeLimit(EMIT_EVERY,
                Suppressed.BufferConfig.maxRecords(MAX_BUFFERED).emitEarlyWhenFull()).withName(name);
    }

    /** Har play pe processing ka time laga do (tests me test driver ki ghadi). */
    private static FixedKeyProcessor<String, PlayEvent, PlayEvent> arrivalTime() {
        return new FixedKeyProcessor<>() {
            private FixedKeyProcessorContext<String, PlayEvent> context;

            @Override
            public void init(FixedKeyProcessorContext<String, PlayEvent> context) {
                this.context = context;
            }

            @Override
            public void process(FixedKeyRecord<String, PlayEvent> record) {
                context.forward(record.withTimestamp(context.currentSystemTimeMs()));
            }
        };
    }

    /**
     * Band hui window ke deltas song ke totals me jodta hai (totals isi task ke store me; exactly-once me har window
     * ek hi baar band hoti hai) aur sirf us window ke chhue seconds ke naye totals bhejta hai.
     */
    private static FixedKeyProcessorSupplier<String, SongTimeline, SongTimeline> addToTotals() {
        return () -> new FixedKeyProcessor<>() {
            private FixedKeyProcessorContext<String, SongTimeline> context;
            private KeyValueStore<String, SongTimeline> totals;

            @Override
            public void init(FixedKeyProcessorContext<String, SongTimeline> context) {
                this.context = context;
                this.totals = context.getStateStore(TIMELINE_TOTALS);
            }

            @Override
            public void process(FixedKeyRecord<String, SongTimeline> record) {
                SongTimeline delta = record.value();
                if (delta == null || record.key() == null) return;
                SongTimeline total = sum(totals.get(record.key()), delta);
                totals.put(record.key(), total);
                context.forward(record.withValue(changedSeconds(total, delta)));
            }
        };
    }

    /** Instant -> UTC tareekh. */
    static LocalDate utcDay(Instant at) {
        return LocalDate.ofInstant(at, ZoneOffset.UTC);
    }

    /** Window ke start ka UTC din. */
    static LocalDate windowDay(Windowed<String> w) {
        return utcDay(Instant.ofEpochMilli(w.window().start()));
    }

    // ---- Pure functions (koi bahar ki call nahi), unit tests se check -----------------------------

    /** Ek play ne jis jis second ko chhua, har second me uska hissa (second ke hisaab se). */
    public static Map<Integer, SongSecondStats> secondDeltas(PlayEvent e) {
        Map<Integer, long[]> acc = new LinkedHashMap<>(); // [listens, exits, skips, seek se gaye, seek se aaye]
        int budget = MAX_SECONDS_PER_PLAY;
        for (ListenRange r : e.getRanges()) {
            int from = (int) (r.getStartMs() / 1000);
            int to = (int) ((r.getEndMs() - 1) / 1000); // aakhri second jahan tak sach me pahuncha
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

    /** Ek play ke per-second hisse ek record me, seconds order me. */
    public static SongTimeline timelineDelta(PlayEvent e) {
        List<SongSecondStats> secs = new ArrayList<>(secondDeltas(e).values());
        secs.sort(Comparator.comparingInt(SongSecondStats::getSec));
        return SongTimeline.newBuilder().setSongId(e.getSongId()).setSeconds(secs).build();
    }

    /** {@code delta} me jo seconds hain, unke {@code total} wale totals. */
    static SongTimeline changedSeconds(SongTimeline total, SongTimeline delta) {
        Map<Integer, SongSecondStats> bySec = new HashMap<>();
        for (SongSecondStats x : total.getSeconds()) bySec.put(x.getSec(), x);
        List<SongSecondStats> out = new ArrayList<>(delta.getSeconds().size());
        for (SongSecondStats d : delta.getSeconds()) out.add(bySec.get(d.getSec()));
        return SongTimeline.newBuilder().setSongId(total.getSongId()).setSeconds(out).build();
    }

    /** Asal me kitne milliseconds sune: ranges bheje hon to unse, warna ratio × duration. */
    public static long listenedMs(PlayEvent e) {
        if (!e.getRanges().isEmpty()) {
            return e.getRanges().stream().mapToLong(r -> r.getEndMs() - r.getStartMs()).sum();
        }
        long duration = e.getDurationMs() != null && e.getDurationMs() > 0 ? e.getDurationMs() : 180_000L;
        return Math.round(e.getListenedRatio() * duration);
    }

    /** Ek play ka din wala hissa: 1 play, stream hua?, poora suna?, kitne ms. */
    public static SongDayStats playDay(PlayEvent e) {
        LocalDate day = utcDay(e.getMeta().getOccurredAt());
        return SongDayStats.newBuilder()
                .setSongId(e.getSongId()).setDay(day)
                .setPlays(1)
                .setQualifiedStreams(StatsTopology.qualifies(e.getListenedRatio(), e.getDurationMs()) ? 1 : 0)
                .setCompletions(e.getListenedRatio() >= COMPLETION_RATIO ? 1 : 0)
                .setListenedMs(listenedMs(e))
                .build();
    }

    /** Ek play ka quality wala hissa: quality, platform, startup time, buffering. */
    public static SongQualityStats qualityDelta(PlayEvent e) {
        LocalDate day = utcDay(e.getMeta().getOccurredAt());
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

    /** Do second-stats ko jodo. */
    static SongSecondStats sum(SongSecondStats a, SongSecondStats b) {
        return SongSecondStats.newBuilder(a)
                .setListens(a.getListens() + b.getListens())
                .setExits(a.getExits() + b.getExits())
                .setSkips(a.getSkips() + b.getSkips())
                .setSeeksAway(a.getSeeksAway() + b.getSeeksAway())
                .setSeeksInto(a.getSeeksInto() + b.getSeeksInto())
                .build();
    }

    /** Seconds jodo aur add karo; koi bhi side null ho sakti hai (khaali store slot). */
    static SongTimeline sum(SongTimeline a, SongTimeline b) {
        if (a == null) return b;
        if (b == null) return a;
        Map<Integer, SongSecondStats> bySec = new TreeMap<>();
        for (SongSecondStats x : a.getSeconds()) bySec.put(x.getSec(), x);
        for (SongSecondStats x : b.getSeconds()) bySec.merge(x.getSec(), x, AnalyticsTopology::sum);
        return SongTimeline.newBuilder().setSongId(a.getSongId()).setSeconds(new ArrayList<>(bySec.values())).build();
    }

    /** Do day-stats ko jodo. */
    static SongDayStats sum(SongDayStats a, SongDayStats b) {
        return SongDayStats.newBuilder(a)
                .setPlays(a.getPlays() + b.getPlays())
                .setQualifiedStreams(a.getQualifiedStreams() + b.getQualifiedStreams())
                .setCompletions(a.getCompletions() + b.getCompletions())
                .setSkips(a.getSkips() + b.getSkips())
                .setListenedMs(a.getListenedMs() + b.getListenedMs())
                .build();
    }

    /** Do quality-stats ko jodo. */
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

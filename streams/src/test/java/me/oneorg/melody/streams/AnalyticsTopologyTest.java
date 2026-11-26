package me.oneorg.melody.streams;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;

import org.apache.kafka.common.serialization.Serdes;
import org.apache.kafka.streams.StreamsBuilder;
import org.apache.kafka.streams.StreamsConfig;
import org.apache.kafka.streams.TestInputTopic;
import org.apache.kafka.streams.TestOutputTopic;
import org.apache.kafka.streams.TopologyTestDriver;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import io.confluent.kafka.streams.serdes.avro.SpecificAvroSerde;
import me.oneorg.melody.events.EventIds;
import me.oneorg.melody.events.ListenRange;
import me.oneorg.melody.events.PlayEvent;
import me.oneorg.melody.events.SeekMove;
import me.oneorg.melody.events.SkipEvent;
import me.oneorg.melody.events.Topics;
import me.oneorg.melody.events.analytics.SongDayStats;
import me.oneorg.melody.events.analytics.SongQualityStats;
import me.oneorg.melody.events.analytics.SongSecondStats;
import me.oneorg.melody.events.analytics.SongTimeline;
import me.oneorg.melody.streams.analytics.AnalyticsTopology;

class AnalyticsTopologyTest {

    private TopologyTestDriver driver;
    private TestInputTopic<String, PlayEvent> plays;
    private TestInputTopic<String, SkipEvent> skips;
    private TestOutputTopic<String, SongTimeline> timeline;
    private TestOutputTopic<String, SongDayStats> daily;
    private TestOutputTopic<String, SongQualityStats> quality;
    private final Instant t0 = Instant.parse("2026-11-25T10:00:00Z");

    @BeforeEach
    void setUp() {
        String scope = "analytics-" + System.nanoTime();
        SpecificAvroSerde<PlayEvent> play = TestSerdes.serde(scope);
        SpecificAvroSerde<SkipEvent> skip = TestSerdes.serde(scope);
        SpecificAvroSerde<SongTimeline> second = TestSerdes.serde(scope);
        SpecificAvroSerde<SongDayStats> day = TestSerdes.serde(scope);
        SpecificAvroSerde<SongQualityStats> q = TestSerdes.serde(scope);
        StreamsBuilder builder = new StreamsBuilder();
        AnalyticsTopology.build(builder, new AnalyticsTopology.AnalyticsSerdes(play, skip, second, day, q));
        Properties props = new Properties();
        props.put(StreamsConfig.APPLICATION_ID_CONFIG, "analytics-test");
        props.put(StreamsConfig.BOOTSTRAP_SERVERS_CONFIG, "dummy:9092");
        props.put(StreamsConfig.STATESTORE_CACHE_MAX_BYTES_CONFIG, 0);
        props.put(StreamsConfig.STATE_DIR_CONFIG, System.getProperty("java.io.tmpdir") + "/analytics-test-" + System.nanoTime());
        driver = new TopologyTestDriver(builder.build(), props, t0);
        var str = Serdes.String();
        plays = driver.createInputTopic(Topics.PLAY, str.serializer(), play.serializer());
        skips = driver.createInputTopic(Topics.SKIP, str.serializer(), skip.serializer());
        timeline = driver.createOutputTopic(Topics.ANALYTICS_SONG_TIMELINE, str.deserializer(), second.deserializer());
        daily = driver.createOutputTopic(Topics.ANALYTICS_SONG_DAILY, str.deserializer(), day.deserializer());
        quality = driver.createOutputTopic(Topics.ANALYTICS_SONG_QUALITY, str.deserializer(), q.deserializer());
    }

    @AfterEach
    void tearDown() {
        driver.close();
    }

    private static ListenRange r(long a, long b) {
        return ListenRange.newBuilder().setStartMs(a).setEndMs(b).build();
    }

    private PlayEvent play(String id, List<ListenRange> ranges, Long exit, boolean skipped, List<SeekMove> seeks,
                           String quality, Long startup, int rebuffers) {
        return PlayEvent.newBuilder().setMeta(EventIds.meta(id, t0, t0, "test"))
                .setUserId("u").setSongId("s1").setListenedRatio(0.5).setDurationMs(10_000L)
                .setRanges(ranges).setExitMs(exit).setSkipped(skipped).setSeeks(seeks)
                .setQuality(quality).setPlatform("ios").setStartupMs(startup).setRebufferCount(rebuffers).setRebufferMs(rebuffers * 500L)
                .build();
    }

    private Duration elapsed = Duration.ZERO;

    /**
     * Moves both clocks forward and sends a play for another song: stream time only
     * advances with records, and suppressed windows are released by stream time.
     */
    private void tick(Duration by) {
        elapsed = elapsed.plus(by);
        driver.advanceWallClockTime(by);
        Instant at = t0.plus(elapsed);
        PlayEvent other = PlayEvent.newBuilder().setMeta(EventIds.meta(EventIds.newId(), at, at, "test"))
                .setUserId("u").setSongId("s-tick").setListenedRatio(0.1).setDurationMs(10_000L)
                .setRanges(List.of(r(0, 1_000))).build();
        plays.pipeInput("u", other, at);
    }

    /** Newest total per second of song s1 across everything emitted so far. */
    private Map<Integer, SongSecondStats> s1Seconds(List<SongTimeline> records) {
        Map<Integer, SongSecondStats> out = new HashMap<>();
        records.stream().filter(t -> t.getSongId().equals("s1"))
                .forEach(t -> t.getSeconds().forEach(x -> out.put(x.getSec(), x)));
        return out;
    }

    @Test
    void secondsCountOncePerPlayAndDuplicatesAreDropped() {
        String a = EventIds.newId();
        // Listened 0-4 s, seeked from 4 s to 7 s, listened 7-9 s, skipped at 9 s.
        PlayEvent first = play(a, List.of(r(0, 4_000), r(7_000, 9_000)), 9_000L, true,
                List.of(SeekMove.newBuilder().setFromMs(4_000).setToMs(7_000).build()), "320kbps", 300L, 1);
        plays.pipeInput("u", first, t0);
        plays.pipeInput("u", first, t0);                       // redelivery: same event id
        plays.pipeInput("u", play(EventIds.newId(), List.of(r(2_000, 5_500)), 5_500L, false, List.of(), "128kbps", 500L, 0), t0);

        assertThat(timeline.isEmpty()).as("nothing leaves until the minute closes").isTrue();
        tick(Duration.ofMinutes(2));

        List<SongTimeline> out = timeline.readValuesToList();
        assertThat(out.stream().filter(x -> x.getSongId().equals("s1"))).as("one record for both plays").hasSize(1);
        Map<Integer, SongSecondStats> t = s1Seconds(out);
        assertThat(t.get(0).getListens()).isEqualTo(1);
        assertThat(t.get(2).getListens()).isEqualTo(2);   // both plays covered 2-3 s
        assertThat(t.get(3).getListens()).isEqualTo(2);
        assertThat(t.get(5).getListens()).isEqualTo(1);   // second play ended at 5.5 s
        assertThat(t.get(5).getExits()).isEqualTo(1);
        assertThat(t).doesNotContainKey(6).as("nobody heard 6 s except via the seek target");
        assertThat(t.get(4).getSeeksAway()).isEqualTo(1);
        assertThat(t.get(7).getSeeksInto()).isEqualTo(1);
        assertThat(t.get(8).getExits()).isEqualTo(1);
        assertThat(t.get(8).getSkips()).isEqualTo(1);
    }

    @Test
    void dailyTotalsCountPlaysSkipsAndListeningTime() {
        plays.pipeInput("u", play(EventIds.newId(), List.of(r(0, 4_000), r(7_000, 9_000)), 9_000L, false, List.of(), "320kbps", 300L, 0), t0);
        plays.pipeInput("u", play(EventIds.newId(), List.of(), null, false, List.of(), null, null, 0), t0); // old client
        skips.pipeInput("u", SkipEvent.newBuilder().setMeta(EventIds.meta(EventIds.newId(), t0, t0, "t"))
                .setUserId("u").setSongId("s1").setPositionMs(1_000L).build(), t0);

        assertThat(daily.isEmpty()).as("rate-limited to one update a minute").isTrue();
        tick(Duration.ofMinutes(2));

        SongDayStats d = daily.readKeyValuesToMap().get("s1|" + LocalDate.parse("2026-11-25"));
        assertThat(d.getPlays()).isEqualTo(2);
        assertThat(d.getSkips()).isEqualTo(1);
        // 6 s from the ranges + 0.5 × 10 s estimated for the old client.
        assertThat(d.getListenedMs()).isEqualTo(6_000 + 5_000);
    }

    @Test
    void deliveryIsGroupedByQualityAndPlatform() {
        plays.pipeInput("u", play(EventIds.newId(), List.of(r(0, 1_000)), 1_000L, false, List.of(), "320kbps", 300L, 1), t0);
        plays.pipeInput("u", play(EventIds.newId(), List.of(r(0, 1_000)), 1_000L, false, List.of(), "320kbps", 500L, 2), t0);
        plays.pipeInput("u", play(EventIds.newId(), List.of(r(0, 1_000)), 1_000L, false, List.of(), null, null, 0), t0);

        tick(Duration.ofMinutes(2));

        Map<String, SongQualityStats> q = quality.readKeyValuesToMap();
        SongQualityStats high = q.get("s1|2026-11-25|320kbps|ios");
        assertThat(high.getPlays()).isEqualTo(2);
        assertThat(high.getStartupMsSum()).isEqualTo(800);
        assertThat(high.getStartupSamples()).isEqualTo(2);
        assertThat(high.getRebufferCount()).isEqualTo(3);
        assertThat(q.get("s1|2026-11-25|unknown|ios").getStartupSamples()).isZero();
    }

    @Test
    void laterWindowsAddToTheTotalsAndSendOnlyTheSecondsTheyChanged() {
        plays.pipeInput("u", play(EventIds.newId(), List.of(r(0, 3_000)), 3_000L, false, List.of(), "320kbps", 300L, 0), t0);
        tick(Duration.ofMinutes(2));
        timeline.readValuesToList();

        Instant later = t0.plus(elapsed);
        PlayEvent second = PlayEvent.newBuilder(play(EventIds.newId(), List.of(r(1_000, 2_000)), 2_000L, false, List.of(), "320kbps", 300L, 0))
                .setMeta(EventIds.meta(EventIds.newId(), later, later, "test")).build();
        plays.pipeInput("u", second, later);
        tick(Duration.ofMinutes(2));

        SongTimeline update = timeline.readValuesToList().stream().filter(x -> x.getSongId().equals("s1")).findFirst().orElseThrow();
        assertThat(update.getSeconds()).extracting(SongSecondStats::getSec).containsExactly(1);
        assertThat(update.getSeconds().get(0).getListens()).as("running total, not the window's delta").isEqualTo(2);
    }

    @Test
    void manyPlaysOfOneSongInAWindowBecomeOneDailyUpdate() {
        for (int i = 0; i < 50; i++) {
            plays.pipeInput("u", play(EventIds.newId(), List.of(r(0, 1_000)), 1_000L, false, List.of(), "128kbps", 100L, 0), t0);
        }
        tick(Duration.ofMinutes(2));
        var records = daily.readRecordsToList().stream().filter(r -> r.key().startsWith("s1|")).toList();
        assertThat(records).hasSize(1);
        assertThat(records.get(0).value().getPlays()).isEqualTo(50);
    }

    @Test
    void aPlayCanNeverAddMoreThanAnHourOfSeconds() {
        PlayEvent huge = play(EventIds.newId(), List.of(r(0, 10_000_000)), null, false, List.of(), null, null, 0);
        assertThat(AnalyticsTopology.secondDeltas(huge).values().stream().mapToLong(SongSecondStats::getListens).sum())
                .isEqualTo(3600);
    }
}

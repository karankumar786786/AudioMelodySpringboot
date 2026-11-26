package me.oneorg.melody.streams.activity;

import java.time.Duration;
import java.time.Instant;

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
import org.apache.kafka.streams.kstream.SessionWindows;
import org.apache.kafka.streams.kstream.Windowed;
import org.apache.kafka.streams.state.SessionStore;

import me.oneorg.melody.events.PlayEvent;
import me.oneorg.melody.events.SkipEvent;
import me.oneorg.melody.events.Topics;
import me.oneorg.melody.events.stats.ListeningSession;
import me.oneorg.melody.streams.config.Dedupe;

/**
 * activityStreams: har user ke listening sessions. Jo plays/skips 30 minute se kam ke gap pe hain
 * wo ek hi session hain (SESSION WINDOW). Do sessions jud jaayein to Kafka Streams purane ke liye null
 * bhejta hai, jise sink delete me badal deta hai.
 */
public final class ActivityTopology {

    /** Topology ke liye zaroori serdes (Avro converters). */
    public record Serdes3(Serde<PlayEvent> play, Serde<SkipEvent> skip, Serde<ListeningSession> session) {}

    private ActivityTopology() {}

    /** Session ki id: userId + start time. */
    public static String sessionId(String userId, long startMs) {
        return userId + ":" + startMs;
    }

    /** Topology: plays + skips -> dedupe -> user ke hisaab se session windows (gap ke andar) -> activity.session.v1. */
    public static void build(StreamsBuilder builder, Serdes3 s, Duration gap) {
        Serde<String> str = Serdes.String();
        Dedupe.addStore(builder, "activity-seen-plays");
        Dedupe.addStore(builder, "activity-seen-skips");

        KStream<String, ListeningSession> plays = builder.stream(Topics.PLAY, Consumed.with(str, s.play()))
                .processValues(Dedupe.<PlayEvent>byEventId("activity-seen-plays", e -> e.getMeta().getEventId()), "activity-seen-plays")
                .map((k, e) -> KeyValue.pair(e.getUserId(), tick(e.getUserId(), 1, 0, listenedMs(e))));

        KStream<String, ListeningSession> skips = builder.stream(Topics.SKIP, Consumed.with(str, s.skip()))
                .processValues(Dedupe.<SkipEvent>byEventId("activity-seen-skips", e -> e.getMeta().getEventId()), "activity-seen-skips")
                .map((k, e) -> KeyValue.pair(e.getUserId(), tick(e.getUserId(), 0, 1, 0)));

        plays.merge(skips)
                .groupByKey(Grouped.with("activity-by-user", str, s.session()))
                .windowedBy(SessionWindows.ofInactivityGapAndGrace(gap, Duration.ofMinutes(10)))
                .aggregate(
                        () -> null,
                        (userId, t, agg) -> sum(agg, t),
                        (userId, a, b) -> sum(a, b),
                        Materialized.<String, ListeningSession, SessionStore<Bytes, byte[]>>as("listening-sessions")
                                .withKeySerde(str).withValueSerde(s.session()))
                .toStream()
                .map((Windowed<String> w, ListeningSession v) -> {
                    String id = sessionId(w.key(), w.window().start());
                    if (v == null) return KeyValue.pair(id, (ListeningSession) null);
                    return KeyValue.pair(id, ListeningSession.newBuilder(v)
                            .setSessionId(id)
                            .setUserId(w.key())
                            .setStartedAt(Instant.ofEpochMilli(w.window().start()))
                            .setEndedAt(Instant.ofEpochMilli(w.window().end()))
                            .build());
                })
                .to(Topics.ACTIVITY_SESSION, Produced.with(str, s.session()));
    }

    /** Play me kitne ms sune (ratio × duration). */
    static long listenedMs(PlayEvent e) {
        long duration = e.getDurationMs() != null && e.getDurationMs() > 0 ? e.getDurationMs() : 180_000L;
        return Math.round(e.getListenedRatio() * duration);
    }

    /** Ek event ka session hissa. */
    private static ListeningSession tick(String userId, int plays, int skips, long listenedMs) {
        Instant epoch = Instant.EPOCH;
        return ListeningSession.newBuilder().setSessionId("").setUserId(userId)
                .setStartedAt(epoch).setEndedAt(epoch)
                .setPlays(plays).setSkips(skips).setListenedMs(listenedMs).build();
    }

    /** Do session hisson ko jodo. */
    private static ListeningSession sum(ListeningSession a, ListeningSession b) {
        if (a == null) return b;
        if (b == null) return a;
        return ListeningSession.newBuilder(a)
                .setPlays(a.getPlays() + b.getPlays())
                .setSkips(a.getSkips() + b.getSkips())
                .setListenedMs(a.getListenedMs() + b.getListenedMs())
                .build();
    }
}

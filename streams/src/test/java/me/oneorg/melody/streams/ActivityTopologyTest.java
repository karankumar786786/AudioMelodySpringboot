package me.oneorg.melody.streams;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Properties;

import org.apache.kafka.common.serialization.Serdes;
import org.apache.kafka.streams.StreamsBuilder;
import org.apache.kafka.streams.StreamsConfig;
import org.apache.kafka.streams.TestInputTopic;
import org.apache.kafka.streams.TestOutputTopic;
import org.apache.kafka.streams.TopologyTestDriver;
import org.junit.jupiter.api.Test;

import io.confluent.kafka.streams.serdes.avro.SpecificAvroSerde;
import me.oneorg.melody.events.EventIds;
import me.oneorg.melody.events.PlayEvent;
import me.oneorg.melody.events.SkipEvent;
import me.oneorg.melody.events.Topics;
import me.oneorg.melody.events.stats.ListeningSession;
import me.oneorg.melody.streams.activity.ActivityTopology;

class ActivityTopologyTest {

    @Test
    void groupsPlaysWithinThirtyMinutesIntoOneSession() {
        String scope = "activity-" + System.nanoTime();
        SpecificAvroSerde<PlayEvent> play = TestSerdes.serde(scope);
        SpecificAvroSerde<SkipEvent> skip = TestSerdes.serde(scope);
        SpecificAvroSerde<ListeningSession> session = TestSerdes.serde(scope);
        StreamsBuilder builder = new StreamsBuilder();
        ActivityTopology.build(builder, new ActivityTopology.Serdes3(play, skip, session), Duration.ofMinutes(30));
        Properties props = new Properties();
        props.put(StreamsConfig.APPLICATION_ID_CONFIG, "activity-test");
        props.put(StreamsConfig.BOOTSTRAP_SERVERS_CONFIG, "dummy:9092");
        props.put(StreamsConfig.STATESTORE_CACHE_MAX_BYTES_CONFIG, 0);
        props.put(StreamsConfig.STATE_DIR_CONFIG, System.getProperty("java.io.tmpdir") + "/activity-test-" + System.nanoTime());

        try (TopologyTestDriver driver = new TopologyTestDriver(builder.build(), props)) {
            var str = Serdes.String();
            TestInputTopic<String, PlayEvent> plays = driver.createInputTopic(Topics.PLAY, str.serializer(), play.serializer());
            TestOutputTopic<String, ListeningSession> out = driver.createOutputTopic(Topics.ACTIVITY_SESSION, str.deserializer(), session.deserializer());

            Instant t0 = Instant.parse("2026-11-20T10:00:00Z");
            for (int minute : new int[] {0, 10, 20, 90}) {
                Instant at = t0.plusSeconds(minute * 60L);
                plays.pipeInput("u1", PlayEvent.newBuilder().setMeta(EventIds.meta(EventIds.newId(), at, at, "t"))
                        .setUserId("u1").setSongId("s").setListenedRatio(1.0).setDurationMs(120_000L).build(), at);
            }

            Map<String, ListeningSession> sessions = out.readKeyValuesToMap();
            ListeningSession first = sessions.get(ActivityTopology.sessionId("u1", t0.toEpochMilli()));
            assertThat(first.getPlays()).isEqualTo(3);
            assertThat(first.getListenedMs()).isEqualTo(360_000L);
            assertThat(first.getEndedAt()).isEqualTo(t0.plusSeconds(20 * 60));
            // The intermediate sessions (start 10:00, ended 10:00 / 10:10) were merged: their last record is null.
            ListeningSession second = sessions.get(ActivityTopology.sessionId("u1", t0.plusSeconds(90 * 60).toEpochMilli()));
            assertThat(second.getPlays()).isEqualTo(1);
            assertThat(sessions.values().stream().filter(v -> v != null).count()).isEqualTo(2);
        }
    }
}

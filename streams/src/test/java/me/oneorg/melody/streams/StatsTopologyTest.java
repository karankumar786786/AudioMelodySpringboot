package me.oneorg.melody.streams;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
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
import me.oneorg.melody.events.ArtistFollowChanged;
import me.oneorg.melody.events.EventIds;
import me.oneorg.melody.events.FavouriteChanged;
import me.oneorg.melody.events.PlayEvent;
import me.oneorg.melody.events.SkipEvent;
import me.oneorg.melody.events.Topics;
import me.oneorg.melody.events.stats.ArtistStats;
import me.oneorg.melody.events.stats.SongDailyStats;
import me.oneorg.melody.events.stats.SongStats;
import me.oneorg.melody.streams.stats.StatsTopology;

/**
 * Unit test: StatsTopology. Kafka Streams topologies TopologyTestDriver se chalti hain - asli Kafka ke bina,
 * nakli input topics me records daal ke output topics padhte hain.
 */
class StatsTopologyTest {

    private TopologyTestDriver driver;
    private TestInputTopic<String, PlayEvent> plays;
    private TestInputTopic<String, SkipEvent> skips;
    private TestInputTopic<String, FavouriteChanged> favourites;
    private TestInputTopic<String, ArtistFollowChanged> follows;
    private TestOutputTopic<String, SongStats> songStats;
    private TestOutputTopic<String, SongDailyStats> daily;
    private TestOutputTopic<String, ArtistStats> artistStats;
    private final Instant t0 = Instant.parse("2026-11-20T10:00:00Z");

    @BeforeEach
    void setUp() {
        String scope = "stats-" + System.nanoTime();
        SpecificAvroSerde<PlayEvent> play = TestSerdes.serde(scope);
        SpecificAvroSerde<SkipEvent> skip = TestSerdes.serde(scope);
        SpecificAvroSerde<FavouriteChanged> fav = TestSerdes.serde(scope);
        SpecificAvroSerde<ArtistFollowChanged> follow = TestSerdes.serde(scope);
        SpecificAvroSerde<SongStats> stats = TestSerdes.serde(scope);
        SpecificAvroSerde<SongDailyStats> day = TestSerdes.serde(scope);
        SpecificAvroSerde<ArtistStats> artist = TestSerdes.serde(scope);
        StreamsBuilder builder = new StreamsBuilder();
        StatsTopology.build(builder, new StatsTopology.Serdes4(play, skip, fav, follow, TestSerdes.serde(scope), stats, day, artist));

        Properties props = new Properties();
        props.put(StreamsConfig.APPLICATION_ID_CONFIG, "stats-test");
        props.put(StreamsConfig.BOOTSTRAP_SERVERS_CONFIG, "dummy:9092");
        props.put(StreamsConfig.STATESTORE_CACHE_MAX_BYTES_CONFIG, 0);
        props.put(StreamsConfig.STATE_DIR_CONFIG, System.getProperty("java.io.tmpdir") + "/stats-test-" + System.nanoTime());
        driver = new TopologyTestDriver(builder.build(), props);

        var str = Serdes.String();
        plays = driver.createInputTopic(Topics.PLAY, str.serializer(), play.serializer());
        skips = driver.createInputTopic(Topics.SKIP, str.serializer(), skip.serializer());
        favourites = driver.createInputTopic(Topics.FAVOURITE, str.serializer(), fav.serializer());
        follows = driver.createInputTopic(Topics.ARTIST_FOLLOW, str.serializer(), follow.serializer());
        songStats = driver.createOutputTopic(Topics.STATS_SONG, str.deserializer(), stats.deserializer());
        daily = driver.createOutputTopic(Topics.STATS_SONG_DAILY, str.deserializer(), day.deserializer());
        artistStats = driver.createOutputTopic(Topics.STATS_ARTIST, str.deserializer(), artist.deserializer());
    }

    @AfterEach
    void tearDown() {
        driver.close();
    }

    private PlayEvent play(String id, String user, String song, double ratio, Long durationMs) {
        return PlayEvent.newBuilder().setMeta(EventIds.meta(id, t0, t0, "test"))
                .setUserId(user).setSongId(song).setListenedRatio(ratio).setDurationMs(durationMs).build();
    }

    private static <V> Map<String, V> last(TestOutputTopic<String, V> topic) {
        return topic.readKeyValuesToMap();
    }

    @Test
    void countsPlaysStreamsSkipsAndFavouritesPerSongAndDropsDuplicates() {
        String dup = EventIds.newId();
        plays.pipeInput("u1", play(dup, "u1", "s1", 0.9, 200_000L), t0);
        plays.pipeInput("u1", play(dup, "u1", "s1", 0.9, 200_000L), t0);          // producer ka retry: same id
        plays.pipeInput("u2", play(EventIds.newId(), "u2", "s1", 0.05, 200_000L), t0); // 10 s: stream nahi
        skips.pipeInput("u2", SkipEvent.newBuilder().setMeta(EventIds.meta(EventIds.newId(), t0, t0, "t"))
                .setUserId("u2").setSongId("s1").build(), t0);
        favourites.pipeInput("u1", FavouriteChanged.newBuilder().setMeta(EventIds.meta(EventIds.newId(), t0, t0, "t"))
                .setUserId("u1").setSongId("s1").setAdded(true).build(), t0);

        SongStats s1 = last(songStats).get("s1");
        assertThat(s1.getPlays()).isEqualTo(2);
        assertThat(s1.getQualifiedStreams()).isEqualTo(1);
        assertThat(s1.getSkips()).isEqualTo(1);
        assertThat(s1.getFavourites()).isEqualTo(1);
        assertThat(s1.getListenedRatioSum()).isEqualTo(0.95, org.assertj.core.data.Offset.offset(1e-9));

        Map<String, SongDailyStats> days = last(daily);
        SongDailyStats d = days.get("s1|2026-11-20");
        assertThat(d).isNotNull();
        assertThat(d.getDay()).isEqualTo(LocalDate.parse("2026-11-20"));
        assertThat(d.getPlays()).isEqualTo(2);
        assertThat(d.getSkips()).isEqualTo(1);
    }

    @Test
    void shortTracksCountAfterHalfAndUnknownDurationUsesThreeMinutes() {
        assertThat(StatsTopology.qualifies(0.6, 20_000L)).isTrue();
        assertThat(StatsTopology.qualifies(0.4, 20_000L)).isFalse();
        assertThat(StatsTopology.qualifies(0.2, null)).isTrue();    // maane hue 180 s me se 36 s
        assertThat(StatsTopology.qualifies(0.1, null)).isFalse();
    }

    @Test
    void countsFollowsPerArtist() {
        for (boolean followed : List.of(true, true, false)) {
            follows.pipeInput("u", ArtistFollowChanged.newBuilder().setMeta(EventIds.meta(EventIds.newId(), t0, t0, "t"))
                    .setUserId("u").setArtistId("a1").setFollowed(followed).build(), t0);
        }
        ArtistStats a1 = last(artistStats).get("a1");
        assertThat(a1.getFollowsGained()).isEqualTo(2);
        assertThat(a1.getFollowsLost()).isEqualTo(1);
    }
}

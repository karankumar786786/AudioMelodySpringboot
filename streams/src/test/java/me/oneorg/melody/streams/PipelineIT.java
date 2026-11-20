package me.oneorg.melody.streams;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.redpanda.RedpandaContainer;

import io.confluent.kafka.serializers.KafkaAvroDeserializer;
import io.confluent.kafka.serializers.KafkaAvroDeserializerConfig;
import io.confluent.kafka.serializers.KafkaAvroSerializer;
import me.oneorg.melody.events.EmailRequested;
import me.oneorg.melody.events.EventIds;
import me.oneorg.melody.events.PlayEvent;
import me.oneorg.melody.events.SongChanged;
import me.oneorg.melody.events.Topics;
import me.oneorg.melody.streams.activity.ActivitySinks;
import me.oneorg.melody.streams.config.PipelineProperties;
import me.oneorg.melody.streams.outbox.OutboxRelay;

/**
 * Real Postgres (with every Flyway migration, V16/V17 included) and real Redpanda:
 * the outbox relay publishes rows as Avro and the history sink writes plays exactly once.
 */
@Testcontainers(disabledWithoutDocker = true)
class PipelineIT {

    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17");
    @Container
    static final RedpandaContainer REDPANDA = new RedpandaContainer("docker.redpanda.com/redpandadata/redpanda:v26.1.20");

    static JdbcTemplate jdbc;
    static TransactionTemplate tx;

    @BeforeAll
    static void migrate() {
        var ds = DataSourceBuilder.create().url(POSTGRES.getJdbcUrl())
                .username(POSTGRES.getUsername()).password(POSTGRES.getPassword()).build();
        Flyway.configure().dataSource(ds)
                .locations("filesystem:../migration/src/main/resources/db/migration")
                .load().migrate();
        jdbc = new JdbcTemplate(ds);
        tx = new TransactionTemplate(new DataSourceTransactionManager(ds));
    }

    private static <V> KafkaTemplate<String, V> template(Class<?> valueSerializer) {
        Map<String, Object> p = new HashMap<>();
        p.put("bootstrap.servers", REDPANDA.getBootstrapServers());
        p.put("key.serializer", org.apache.kafka.common.serialization.StringSerializer.class);
        p.put("value.serializer", valueSerializer);
        p.put("schema.registry.url", REDPANDA.getSchemaRegistryAddress());
        return new KafkaTemplate<>(new DefaultKafkaProducerFactory<>(p));
    }

    private static <V> List<V> consume(String topic, int expected) {
        Map<String, Object> c = new HashMap<>();
        c.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, REDPANDA.getBootstrapServers());
        c.put(ConsumerConfig.GROUP_ID_CONFIG, "it-" + UUID.randomUUID());
        c.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        c.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        c.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, KafkaAvroDeserializer.class);
        c.put("schema.registry.url", REDPANDA.getSchemaRegistryAddress());
        c.put(KafkaAvroDeserializerConfig.SPECIFIC_AVRO_READER_CONFIG, true);
        List<V> out = new ArrayList<>();
        try (KafkaConsumer<String, V> consumer = new KafkaConsumer<>(c)) {
            consumer.subscribe(List.of(topic));
            long deadline = System.currentTimeMillis() + 20_000;
            while (out.size() < expected && System.currentTimeMillis() < deadline) {
                consumer.poll(Duration.ofMillis(500)).forEach(r -> out.add(r.value()));
            }
        }
        return out;
    }

    @Test
    void outboxRelayPublishesRowsAsAvroAndBlanksEmailPayloads() {
        UUID songRow = UUID.randomUUID();
        UUID emailRow = UUID.randomUUID();
        UUID badRow = UUID.randomUUID();
        jdbc.update("INSERT INTO outbox_events (id, topic, msg_key, payload, source) VALUES (?, ?, ?, CAST(? AS jsonb), 'admin-api')",
                songRow, Topics.CATALOG_SONG, "s1", "{\"song_id\":\"s1\",\"change\":\"PUBLISHED\",\"title\":\"T\",\"artist_ids\":[\"a1\"],\"status\":\"ACTIVE\"}");
        jdbc.update("INSERT INTO outbox_events (id, topic, msg_key, payload, source) VALUES (?, ?, ?, CAST(? AS jsonb), 'core-api')",
                emailRow, Topics.EMAIL, "hash", "{\"to\":\"a@b.com\",\"kind\":\"LOGIN\",\"subject\":\"LOGIN\",\"body\":\"123456\",\"attempt\":0}");
        jdbc.update("INSERT INTO outbox_events (id, topic, msg_key, payload, source) VALUES (?, ?, ?, CAST(? AS jsonb), 'core-api')",
                badRow, Topics.FAVOURITE, "u", "{\"user_id\":\"u\"}");

        OutboxRelay relay = new OutboxRelay(jdbc, tx, template(KafkaAvroSerializer.class), bytesTemplate());
        relay.sweep();

        List<SongChanged> songs = consume(Topics.CATALOG_SONG, 1);
        assertThat(songs).hasSize(1);
        assertThat(songs.get(0).getMeta().getEventId()).isEqualTo(songRow.toString());
        assertThat(songs.get(0).getArtistIds()).containsExactly("a1");

        List<EmailRequested> emails = consume(Topics.EMAIL, 1);
        assertThat(emails.get(0).getBody()).isEqualTo("123456");

        assertThat(jdbc.queryForObject("SELECT sent_at IS NOT NULL FROM outbox_events WHERE id = ?", Boolean.class, songRow)).isTrue();
        assertThat(jdbc.queryForObject("SELECT payload::text FROM outbox_events WHERE id = ?", String.class, emailRow)).isEqualTo("{}");
        // The malformed row stays pending with its error, to be retried and then dead-lettered.
        assertThat(jdbc.queryForObject("SELECT sent_at IS NULL AND attempts = 1 FROM outbox_events WHERE id = ?", Boolean.class, badRow)).isTrue();
        // A second sweep publishes nothing new.
        relay.sweep();
        assertThat(consume(Topics.CATALOG_SONG, 2)).hasSize(1);
    }

    private static KafkaTemplate<byte[], byte[]> bytesTemplate() {
        Map<String, Object> p = new HashMap<>();
        p.put("bootstrap.servers", REDPANDA.getBootstrapServers());
        p.put("key.serializer", org.apache.kafka.common.serialization.ByteArraySerializer.class);
        p.put("value.serializer", org.apache.kafka.common.serialization.ByteArraySerializer.class);
        return new KafkaTemplate<>(new DefaultKafkaProducerFactory<>(p));
    }

    @Test
    void historySinkWritesEachPlayOnceAndCountsQualifiedStreams() throws Exception {
        jdbc.update("INSERT INTO users (id, user_name, email) VALUES ('u-it', 'it', 'it@example.com') ON CONFLICT DO NOTHING");
        jdbc.update("""
                INSERT INTO songs (id, title, artist_name, duration, song_key, image_key, language, lrclib_id, status, job_id)
                VALUES ('s-it', 'Song', 'Artist', 200, 'k', 'i', 'en', 'l', 'ACTIVE', 'j')
                ON CONFLICT DO NOTHING
                """);
        PipelineProperties props = new PipelineProperties(null, null, 1, true, false, false, null, null);
        ActivitySinks sinks = new ActivitySinks(jdbc, tx, props);
        Instant at = Instant.parse("2026-11-20T10:00:00Z");
        PlayEvent full = PlayEvent.newBuilder().setMeta(EventIds.meta(EventIds.newId(), at, at, "t"))
                .setUserId("u-it").setSongId("s-it").setListenedRatio(1.0).setDurationMs(200_000L).build();
        PlayEvent tooShort = PlayEvent.newBuilder().setMeta(EventIds.meta(EventIds.newId(), at, at, "t"))
                .setUserId("u-it").setSongId("s-it").setListenedRatio(0.05).setDurationMs(200_000L).build();
        PlayEvent unknownSong = PlayEvent.newBuilder().setMeta(EventIds.meta(EventIds.newId(), at, at, "t"))
                .setUserId("u-it").setSongId("missing").setListenedRatio(1.0).build();

        var method = ActivitySinks.class.getDeclaredMethod("writeHistory", List.class);
        method.setAccessible(true);
        tx.executeWithoutResult(s -> invoke(method, sinks, List.of(full, tooShort, unknownSong)));
        tx.executeWithoutResult(s -> invoke(method, sinks, List.of(full)));   // redelivery

        assertThat(jdbc.queryForObject("SELECT count(*) FROM user_history WHERE user_id = 'u-it'", Long.class)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT total_streams FROM song_metadata WHERE song_id = 's-it'", Long.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT total_count FROM pagination_metadata WHERE entity_name = 'UserHistory_u-it'", Long.class)).isEqualTo(2);
    }

    private static void invoke(java.lang.reflect.Method m, Object target, Object arg) {
        try {
            m.invoke(target, arg);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

}

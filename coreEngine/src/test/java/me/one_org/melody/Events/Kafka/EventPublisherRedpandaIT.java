package me.one_org.melody.Events.Kafka;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.apache.avro.specific.SpecificRecord;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.redpanda.RedpandaContainer;

import io.confluent.kafka.serializers.KafkaAvroDeserializer;
import io.confluent.kafka.serializers.KafkaAvroDeserializerConfig;
import io.confluent.kafka.serializers.KafkaAvroSerializer;
import me.oneorg.melody.events.EventIds;
import me.oneorg.melody.events.PlayEvent;
import me.oneorg.melody.events.Topics;

/** Asli Redpanda + Schema Registry pe Avro event bhejta hai aur wapas padh ke check karta hai. */
@Testcontainers(disabledWithoutDocker = true)
class EventPublisherRedpandaIT {

    @Container
    static final RedpandaContainer REDPANDA = new RedpandaContainer("docker.redpanda.com/redpandadata/redpanda:v26.1.20");

    private static KafkaTemplate<String, SpecificRecord> template(String bootstrap) {
        Map<String, Object> props = new HashMap<>();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrap);
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, KafkaAvroSerializer.class);
        props.put(ProducerConfig.ACKS_CONFIG, "all");
        props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);
        props.put(ProducerConfig.MAX_BLOCK_MS_CONFIG, 2000);
        props.put(ProducerConfig.DELIVERY_TIMEOUT_MS_CONFIG, 3000);
        props.put(ProducerConfig.REQUEST_TIMEOUT_MS_CONFIG, 2000);
        props.put("schema.registry.url", REDPANDA.getSchemaRegistryAddress());
        return new KafkaTemplate<>(new DefaultKafkaProducerFactory<>(props));
    }

    @Test
    void publishesAvroThatConsumersCanRead() {
        EventsProperties props = new EventsProperties(EventsMode.KAFKA, null, Duration.ofSeconds(10), 0, 0, null, 0, null);
        EventPublisher publisher = new EventPublisher(template(REDPANDA.getBootstrapServers()), props);

        PlayEvent event = PlayEvent.newBuilder()
                .setMeta(EventIds.serverMeta("test")).setUserId("u-1").setSongId("s-1").setListenedRatio(0.9)
                .build();
        publisher.publish(Topics.PLAY, "u-1", event, Instant.now());

        Map<String, Object> c = new HashMap<>();
        c.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, REDPANDA.getBootstrapServers());
        c.put(ConsumerConfig.GROUP_ID_CONFIG, "it");
        c.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        c.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        c.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, KafkaAvroDeserializer.class);
        c.put("schema.registry.url", REDPANDA.getSchemaRegistryAddress());
        c.put(KafkaAvroDeserializerConfig.SPECIFIC_AVRO_READER_CONFIG, true);
        try (KafkaConsumer<String, PlayEvent> consumer = new KafkaConsumer<>(c)) {
            consumer.subscribe(List.of(Topics.PLAY));
            PlayEvent read = null;
            long deadline = System.currentTimeMillis() + 20_000;
            while (read == null && System.currentTimeMillis() < deadline) {
                ConsumerRecords<String, PlayEvent> records = consumer.poll(Duration.ofMillis(500));
                for (var r : records) {
                    assertThat(r.key()).isEqualTo("u-1");
                    read = r.value();
                }
            }
            assertThat(read).isNotNull();
            assertThat(read.getMeta().getEventId()).isEqualTo(event.getMeta().getEventId());
            assertThat(read.getListenedRatio()).isEqualTo(0.9);
        }
    }

    @Test
    void kafkaModeFailsFastWhenTheBrokerIsUnreachable() {
        EventsProperties props = new EventsProperties(EventsMode.KAFKA, null, Duration.ofSeconds(4), 0, 0, null, 0, null);
        EventPublisher publisher = new EventPublisher(template("localhost:1"), props);
        PlayEvent event = PlayEvent.newBuilder()
                .setMeta(EventIds.serverMeta("test")).setUserId("u-1").setSongId("s-1").setListenedRatio(0.9)
                .build();

        long start = System.currentTimeMillis();
        assertThatThrownBy(() -> publisher.publish(Topics.PLAY, "u-1", event, Instant.now()))
                .isInstanceOf(EventsUnavailableException.class);
        assertThat(System.currentTimeMillis() - start).isLessThan(8_000);
    }
}

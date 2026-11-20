package me.one_org.melody.Events.Kafka;

import me.one_org.melody.Aspects.NoLogging;

import java.time.Instant;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import org.apache.avro.specific.SpecificRecord;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import io.github.resilience4j.bulkhead.Bulkhead;
import io.github.resilience4j.bulkhead.BulkheadConfig;
import lombok.extern.slf4j.Slf4j;

/**
 * Sends Avro events to Kafka. A bulkhead caps in-flight sends, so a slow or down broker
 * can't pile up work behind the request threads that serve playback and login.
 */
@NoLogging
@Component
@Slf4j
public class EventPublisher {

    private final KafkaTemplate<String, SpecificRecord> kafkaTemplate;
    private final EventsProperties properties;
    private final Bulkhead bulkhead;

    public EventPublisher(KafkaTemplate<String, SpecificRecord> avroKafkaTemplate, EventsProperties properties) {
        this.kafkaTemplate = avroKafkaTemplate;
        this.properties = properties;
        this.bulkhead = Bulkhead.of("kafka-events", BulkheadConfig.custom()
                .maxConcurrentCalls(properties.maxConcurrentSends())
                .maxWaitDuration(java.time.Duration.ZERO)
                .build());
    }

    public EventsMode mode() {
        return properties.mode();
    }

    /**
     * KAFKA mode: waits for the broker's ack and throws EventsUnavailableException on
     * failure or timeout. DUAL mode: fire-and-forget; failures are only logged, because the
     * legacy path still does the real work.
     */
    public void publish(String topic, String key, SpecificRecord value, Instant occurredAt) {
        if (!properties.mode().producesEvents()) return;
        boolean strict = properties.mode() == EventsMode.KAFKA;

        if (!bulkhead.tryAcquirePermission()) {
            if (strict) throw new EventsUnavailableException("Event pipeline is busy, retry shortly", null);
            log.debug("Dropping {} event in DUAL mode: too many sends in flight", topic);
            return;
        }

        CompletableFuture<?> future;
        try {
            ProducerRecord<String, SpecificRecord> record =
                    new ProducerRecord<>(topic, null, occurredAt.toEpochMilli(), key, value);
            future = kafkaTemplate.send(record).whenComplete((r, e) -> bulkhead.onComplete());
        } catch (Exception e) {
            bulkhead.onComplete();
            if (strict) throw new EventsUnavailableException("Event pipeline unavailable", e);
            log.warn("Kafka send to {} failed (DUAL mode, ignored): {}", topic, e.getMessage());
            return;
        }

        if (!strict) {
            future.whenComplete((r, e) -> {
                if (e != null) log.warn("Kafka send to {} failed (DUAL mode, ignored): {}", topic, e.getMessage());
            });
            return;
        }

        try {
            future.get(properties.produceTimeout().toMillis(), TimeUnit.MILLISECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new EventsUnavailableException("Interrupted while sending event", e);
        } catch (Exception e) {
            throw new EventsUnavailableException("Event pipeline unavailable", e);
        }
    }
}

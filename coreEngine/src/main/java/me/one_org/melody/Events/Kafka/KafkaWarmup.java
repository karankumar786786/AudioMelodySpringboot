package me.one_org.melody.Events.Kafka;

import java.util.List;

import org.apache.avro.specific.SpecificRecord;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Aspects.NoLogging;
import me.oneorg.melody.events.Topics;

/**
 * Opens the producers' connections and fetches topic metadata in the background at
 * start-up, so the first telemetry call or outbox write doesn't wait for it.
 */
@NoLogging
@Component
@Slf4j
public class KafkaWarmup {

    private final EventsProperties properties;
    private final KafkaTemplate<String, SpecificRecord> avro;
    private final KafkaTemplate<String, String> strings;

    public KafkaWarmup(EventsProperties properties, KafkaTemplate<String, SpecificRecord> avroKafkaTemplate,
                       KafkaTemplate<String, String> stringKafkaTemplate) {
        this.properties = properties;
        this.avro = avroKafkaTemplate;
        this.strings = stringKafkaTemplate;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void warmUp() {
        if (!properties.mode().producesEvents()) return;
        Thread.ofVirtual().name("kafka-warmup").start(() -> {
            try {
                strings.partitionsFor(Topics.OUTBOX_WAKEUP);
                for (String topic : List.of(Topics.PLAY, Topics.SKIP, Topics.SEARCH_INTERACTION, Topics.QUEUE_CHANGE, Topics.FEEDBACK)) {
                    avro.partitionsFor(topic);
                }
                log.info("Kafka producers ready (events mode {})", properties.mode());
            } catch (Exception e) {
                log.warn("Kafka not reachable at start-up ({}); events retry on first use", e.getMessage());
            }
        });
    }
}

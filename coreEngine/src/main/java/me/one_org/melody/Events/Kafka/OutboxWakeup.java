package me.one_org.melody.Events.Kafka;

import me.one_org.melody.Aspects.NoLogging;

import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;
import me.oneorg.melody.events.Topics;

/**
 * Tells outboxRelay that new rows are waiting. Best effort: a lost signal only delays
 * publishing until the next signal or the relay's slow safety sweep.
 */
@NoLogging
@Component
@Slf4j
public class OutboxWakeup {

    private final KafkaTemplate<String, String> kafkaTemplate;

    public OutboxWakeup(KafkaTemplate<String, String> stringKafkaTemplate) {
        this.kafkaTemplate = stringKafkaTemplate;
    }

    public void signal() {
        try {
            kafkaTemplate.send(Topics.OUTBOX_WAKEUP, "core-api", "1")
                    .whenComplete((r, e) -> {
                        if (e != null) log.debug("Outbox wake-up not delivered: {}", e.getMessage());
                    });
        } catch (Exception e) {
            log.debug("Outbox wake-up not sent: {}", e.getMessage());
        }
    }
}

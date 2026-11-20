package me.one_org.melody.Events.Kafka;

import java.util.Map;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import lombok.extern.slf4j.Slf4j;
import me.oneorg.melody.events.EventIds;
import tools.jackson.databind.json.JsonMapper;

/**
 * Writes a row to outbox_events inside the caller's transaction, so the event exists
 * exactly when the change it describes was committed. outboxRelay publishes it.
 * After commit it nudges the relay through Kafka (OutboxWakeup) so it publishes within
 * milliseconds without polling the database (which would keep Neon awake).
 */
@Component
@Slf4j
public class OutboxWriter {

    private final JdbcClient jdbcClient;
    private final EventsProperties properties;
    private final OutboxWakeup wakeup;
    private final JsonMapper json = JsonMapper.builder().build();

    public OutboxWriter(JdbcClient jdbcClient, EventsProperties properties, OutboxWakeup wakeup) {
        this.jdbcClient = jdbcClient;
        this.properties = properties;
        this.wakeup = wakeup;
    }

    /** @return the new row's id (also the event_id the consumers will see). */
    public UUID write(String topic, String key, Map<String, Object> payload) {
        UUID id = UUID.fromString(EventIds.newId());
        jdbcClient.sql("""
                INSERT INTO outbox_events (id, topic, msg_key, payload, source)
                VALUES (:id, :topic, :key, CAST(:payload AS jsonb), :source)
                """)
                .param("id", id)
                .param("topic", topic)
                .param("key", key)
                .param("payload", json.writeValueAsString(payload))
                .param("source", properties.source())
                .update();

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    wakeup.signal();
                }
            });
        } else {
            wakeup.signal();
        }
        return id;
    }
}

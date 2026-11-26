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
 * outbox_events table me ek row likhta hai - caller ke transaction ke andar.
 * Isliye event tabhi exist karega jab uska data change sach me commit hua ho.
 * Row ko streams/ ka outboxRelay Kafka pe publish karta hai.
 *
 * Commit ke baad relay ko Kafka se "jaago" signal (OutboxWakeup) bhejte hain, taaki wo turant
 * publish kare. Relay ko baar baar DB check (polling) nahi karna padta - polling se Neon
 * database kabhi "so" nahi paata aur bill badhta hai.
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

    /**
     * Outbox row likhta hai. payload JSON (jsonb) me jaata hai.
     * @return nayi row ki id - yahi event_id consumers ko dikhegi.
     */
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

        // Transaction chal raha hai to commit ke BAAD signal bhejo (commit fail hua to signal nahi).
        // Transaction nahi hai to row already save hai, turant signal bhej do.
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

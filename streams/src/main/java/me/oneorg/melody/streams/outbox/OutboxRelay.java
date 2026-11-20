package me.oneorg.melody.streams.outbox;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import org.apache.avro.specific.SpecificRecord;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import lombok.extern.slf4j.Slf4j;
import me.oneorg.melody.events.EventIds;
import me.oneorg.melody.events.EventMeta;
import me.oneorg.melody.events.OutboxPayloads;
import me.oneorg.melody.events.Topics;
import tools.jackson.databind.json.JsonMapper;

/**
 * outboxRelay: publishes outbox_events rows written by the core and admin APIs.
 *
 * <p>It doesn't poll Postgres (that would keep Neon awake all day). It sweeps when a
 * writer's wake-up record arrives on outbox.wakeup.v1, once at start-up, and on a slow
 * safety timer (default every 6 h) for rows whose wake-up was lost.
 *
 * <p>Each sweep locks a batch with FOR UPDATE SKIP LOCKED, publishes it with an idempotent
 * producer, waits for the acks, then marks the rows sent in the same transaction. A crash
 * between the ack and the commit republishes the batch; consumers drop duplicates by
 * event_id, which is the row id. A row that can't be converted is tried 5 times, then
 * sent to the DLQ as raw JSON and marked sent.
 */
@Component
@Profile("outbox-relay")
@Slf4j
public class OutboxRelay {

    static final int BATCH = 200;
    static final int MAX_ATTEMPTS = 5;

    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final KafkaTemplate<String, SpecificRecord> avro;
    private final KafkaTemplate<byte[], byte[]> dlq;
    private final JsonMapper json = JsonMapper.builder().build();
    private final AtomicBoolean running = new AtomicBoolean();
    private final AtomicBoolean again = new AtomicBoolean();
    private volatile Instant lastCleanup = Instant.EPOCH;

    public OutboxRelay(JdbcTemplate jdbc, TransactionTemplate tx, KafkaTemplate<String, SpecificRecord> avroTemplate,
                       KafkaTemplate<byte[], byte[]> dlqTemplate) {
        this.jdbc = jdbc;
        this.tx = tx;
        this.avro = avroTemplate;
        this.dlq = dlqTemplate;
    }

    record Row(UUID id, String topic, String key, String payload, String source, Instant createdAt, int attempts) {}

    @KafkaListener(id = "outbox-wakeup", topics = Topics.OUTBOX_WAKEUP, containerFactory = "wakeupFactory")
    public void onWakeup(List<String> signals) {
        sweep();
    }

    @Scheduled(initialDelayString = "PT5S", fixedDelayString = "${melody.streams.outbox-safety-sweep:PT6H}")
    public void safetySweep() {
        sweep();
    }

    /** Publishes everything pending. Concurrent calls collapse into one more pass. */
    public int sweep() {
        if (!running.compareAndSet(false, true)) {
            again.set(true);
            return 0;
        }
        int total = 0;
        try {
            do {
                again.set(false);
                int n;
                do {
                    Integer published = tx.execute(status -> publishBatch());
                    n = published == null ? 0 : published;
                    total += n;
                } while (n == BATCH);
            } while (again.get());
            cleanupIfDue();
        } catch (Exception e) {
            log.warn("Outbox sweep stopped: {} (rows stay pending and are retried on the next wake-up)", e.getMessage());
        } finally {
            running.set(false);
        }
        if (total > 0) log.info("Outbox relay published {} events", total);
        return total;
    }

    int publishBatch() {
        List<Row> rows = jdbc.query("""
                SELECT id, topic, msg_key, payload::text, source, created_at, attempts
                  FROM outbox_events
                 WHERE sent_at IS NULL
                 ORDER BY created_at
                 LIMIT ?
                 FOR UPDATE SKIP LOCKED
                """, (rs, i) -> new Row(rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3), rs.getString(4),
                rs.getString(5), rs.getTimestamp(6).toInstant(), rs.getInt(7)), BATCH);
        if (rows.isEmpty()) return 0;

        List<CompletableFuture<?>> acks = new ArrayList<>();
        List<Row> published = new ArrayList<>();
        for (Row row : rows) {
            SpecificRecord value;
            try {
                value = convert(row);
            } catch (Exception e) {
                failed(row, e);
                continue;
            }
            ProducerRecord<String, SpecificRecord> record =
                    new ProducerRecord<>(row.topic(), null, row.createdAt().toEpochMilli(), row.key(), value);
            acks.add(avro.send(record));
            published.add(row);
        }
        avro.flush();
        try {
            CompletableFuture.allOf(acks.toArray(CompletableFuture[]::new)).get(30, TimeUnit.SECONDS);
        } catch (Exception e) {
            // Roll back: nothing is marked sent; the whole batch is retried next time.
            throw new IllegalStateException("Kafka did not acknowledge the outbox batch", e);
        }
        markSent(published);
        return rows.size();
    }

    @SuppressWarnings("unchecked")
    SpecificRecord convert(Row row) {
        Map<String, Object> payload = json.readValue(row.payload(), Map.class);
        EventMeta meta = EventIds.meta(row.id().toString(), row.createdAt(), row.createdAt(), row.source());
        return OutboxPayloads.toAvro(row.topic(), payload, meta);
    }

    private void markSent(List<Row> rows) {
        if (rows.isEmpty()) return;
        jdbc.batchUpdate("""
                UPDATE outbox_events
                   SET sent_at = now(), attempts = attempts + 1, last_error = NULL,
                       payload = CASE WHEN topic LIKE 'notification.email%' THEN '{}'::jsonb ELSE payload END
                 WHERE id = ?
                """, rows, rows.size(), (ps, r) -> ps.setObject(1, r.id()));
    }

    private void failed(Row row, Exception e) {
        String error = String.valueOf(e.getMessage());
        if (error.length() > 450) error = error.substring(0, 450);
        int attempts = row.attempts() + 1;
        if (attempts >= MAX_ATTEMPTS) {
            boolean sensitive = row.topic().startsWith("notification.email");
            ProducerRecord<byte[], byte[]> record = new ProducerRecord<>(Topics.DLQ,
                    row.key() == null ? null : row.key().getBytes(StandardCharsets.UTF_8),
                    (sensitive ? "{\"redacted\":true}" : row.payload()).getBytes(StandardCharsets.UTF_8));
            record.headers().add("source-topic", row.topic().getBytes(StandardCharsets.UTF_8));
            record.headers().add("outbox-id", row.id().toString().getBytes(StandardCharsets.UTF_8));
            record.headers().add("error", error.getBytes(StandardCharsets.UTF_8));
            dlq.send(record);
            jdbc.update("UPDATE outbox_events SET sent_at = now(), attempts = ?, last_error = ? WHERE id = ?",
                    attempts, "dead-lettered: " + error, row.id());
            log.error("Outbox row {} ({}) dead-lettered after {} attempts: {}", row.id(), row.topic(), attempts, error);
        } else {
            jdbc.update("UPDATE outbox_events SET attempts = ?, last_error = ? WHERE id = ?", attempts, error, row.id());
            log.warn("Outbox row {} ({}) could not be converted (attempt {}): {}", row.id(), row.topic(), attempts, error);
        }
    }

    /** Deletes rows published more than 3 days ago, at most once an hour, while the database is awake anyway. */
    private void cleanupIfDue() {
        if (Instant.now().isBefore(lastCleanup.plusSeconds(3600))) return;
        lastCleanup = Instant.now();
        int deleted = jdbc.update("DELETE FROM outbox_events WHERE sent_at IS NOT NULL AND sent_at < ?",
                Timestamp.from(Instant.now().minusSeconds(3 * 24 * 3600)));
        if (deleted > 0) log.info("Outbox cleanup removed {} published rows", deleted);
    }
}

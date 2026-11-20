package me.one_org.melody.Events.Kafka;

import java.time.Duration;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Aspects.NoLogging;
import me.oneorg.melody.events.Topics;

/**
 * Tells outboxRelay that new rows are waiting. Sent on a background thread, so a cold or
 * slow broker never delays the request that wrote the row. While Kafka is down it keeps
 * one pending wake-up and retries with backoff (5 s doubling to 60 s, for up to 15 min),
 * so rows written during an outage are published soon after Kafka returns. Past that the
 * relay's safety sweep picks them up; OTP emails also have MailQueue's 30 s fallback.
 */
@NoLogging
@Component
@Slf4j
public class OutboxWakeup {

    static final Duration GIVE_UP_AFTER = Duration.ofMinutes(15);

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ScheduledExecutorService sender = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "outbox-wakeup");
        t.setDaemon(true);
        return t;
    });
    /** A wake-up is queued or being retried; further signals ride along with it. */
    private final AtomicBoolean pending = new AtomicBoolean();

    public OutboxWakeup(KafkaTemplate<String, String> stringKafkaTemplate) {
        this.kafkaTemplate = stringKafkaTemplate;
    }

    public void signal() {
        if (pending.compareAndSet(false, true)) {
            sender.execute(() -> attempt(System.currentTimeMillis(), 5_000L));
        }
    }

    private void attempt(long firstTry, long nextDelayMs) {
        try {
            kafkaTemplate.send(Topics.OUTBOX_WAKEUP, "core-api", "1").get(5, TimeUnit.SECONDS);
            pending.set(false);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            pending.set(false);
        } catch (Exception e) {
            if (System.currentTimeMillis() - firstTry > GIVE_UP_AFTER.toMillis()) {
                pending.set(false);
                log.warn("Outbox wake-up not delivered for {}; the relay's safety sweep will publish the rows", GIVE_UP_AFTER);
                return;
            }
            log.debug("Outbox wake-up failed ({}); retrying in {} ms", e.getMessage(), nextDelayMs);
            sender.schedule(() -> attempt(firstTry, Math.min(nextDelayMs * 2, 60_000L)), nextDelayMs, TimeUnit.MILLISECONDS);
        }
    }

    @PreDestroy
    void shutdown() {
        sender.shutdownNow();
    }
}

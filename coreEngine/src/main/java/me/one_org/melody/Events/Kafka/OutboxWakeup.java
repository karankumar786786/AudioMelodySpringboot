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
 * outboxRelay ko "naye outbox rows aaye hain, utha lo" ka signal bhejta hai (Kafka topic outbox.wakeup.v1).
 *
 * - Background thread pe chalta hai, to Kafka slow ho to bhi user ki request nahi rukti.
 * - Kafka down ho to ek hi pending wake-up rakhta hai aur retry karta hai: 5s, 10s, 20s ... max 60s,
 *   15 minute tak. Kafka wapas aate hi rows jaldi publish ho jaati hain.
 * - 15 minute ke baad bhi na jaaye to relay ka "safety sweep" (har kuch ghante) rows utha leta hai.
 *   OTP emails ke liye MailQueue ka 30 second wala fallback bhi hai.
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
    /** Ek wake-up pehle se line me hai ya retry ho raha hai - naye signals usi ke saath chale jaayenge. */
    private final AtomicBoolean pending = new AtomicBoolean();

    public OutboxWakeup(KafkaTemplate<String, String> stringKafkaTemplate) {
        this.kafkaTemplate = stringKafkaTemplate;
    }

    /**
     * Wake-up bhejo. compareAndSet: agar pehle se koi pending nahi hai tabhi naya schedule karo
     * (100 rows likhe to bhi ek hi wake-up jaata hai).
     */
    public void signal() {
        if (pending.compareAndSet(false, true)) {
            sender.execute(() -> attempt(System.currentTimeMillis(), 5_000L));
        }
    }

    /** Ek koshish: bhejo aur 5 second tak ack ka wait. Fail ho to delay double karke dobara schedule. */
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

    /** App band hote waqt background thread rok do. */
    @PreDestroy
    void shutdown() {
        sender.shutdownNow();
    }
}

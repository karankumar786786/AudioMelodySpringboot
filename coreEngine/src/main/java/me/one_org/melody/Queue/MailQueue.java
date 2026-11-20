package me.one_org.melody.Queue;

import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Dto.Queue.MailQueueDto;
import me.one_org.melody.Events.Kafka.EventsProperties;
import me.one_org.melody.Events.Kafka.OutboxWriter;
import me.oneorg.melody.events.Topics;

/**
 * Sends OTP mail.
 * LEGACY mode: pushes to the Redis mail_queue for the Bun mail worker (as before).
 * DUAL/KAFKA: writes a notification.email.v1 outbox row, which outboxRelay publishes and
 * notificationStreams sends. Login can't wait on a broken pipeline, so if the row is
 * still unpublished after melody.events.otp-fallback-after (30 s) the core claims it and
 * pushes it to the Redis queue instead. Claiming sets sent_at, so it's never sent twice.
 */
@Component
@Slf4j
public class MailQueue {

    private final RedisTemplate<String, Object> redisTemplate;
    private final EventsProperties eventsProperties;
    private final OutboxWriter outboxWriter;
    private final JdbcClient jdbcClient;
    private final ScheduledExecutorService fallbackTimer = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "otp-fallback");
        t.setDaemon(true);
        return t;
    });

    @Value("${spring.data.redis.mailqueue}")
    private String mailQueue;

    public MailQueue(RedisTemplate<String, Object> redisTemplate, EventsProperties eventsProperties,
                     OutboxWriter outboxWriter, JdbcClient jdbcClient) {
        this.redisTemplate = redisTemplate;
        this.eventsProperties = eventsProperties;
        this.outboxWriter = outboxWriter;
        this.jdbcClient = jdbcClient;
    }

    public void queueMail(MailQueueDto data) {
        if (!eventsProperties.mode().producesEvents()) {
            redisTemplate.opsForList().rightPush(mailQueue, data);
            return;
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("to", data.to());
        payload.put("kind", data.subject());
        // Same subject and body the Bun worker sends today.
        payload.put("subject", data.subject());
        payload.put("body", data.otp());
        payload.put("attempt", 0);
        UUID id = outboxWriter.write(Topics.EMAIL, addressKey(data.to()), payload);

        long delay = eventsProperties.otpFallbackAfter().toMillis();
        fallbackTimer.schedule(() -> fallbackIfUnsent(id, data), delay, TimeUnit.MILLISECONDS);
    }

    void fallbackIfUnsent(UUID id, MailQueueDto data) {
        try {
            int claimed = jdbcClient.sql("""
                    UPDATE outbox_events
                       SET sent_at = now(), last_error = 'sent through the Redis mail queue fallback',
                           payload = '{}'::jsonb
                     WHERE id = :id AND sent_at IS NULL
                    """).param("id", id).update();
            if (claimed == 1) {
                log.warn("OTP email {} was not published within {}; sending through the Redis mail queue", id,
                        eventsProperties.otpFallbackAfter());
                redisTemplate.opsForList().rightPush(mailQueue, data);
            }
        } catch (Exception e) {
            log.error("OTP fallback for {} failed: {}", id, e.getMessage());
        }
    }

    /** Kafka key for email events: a hash, so addresses don't show up in topic keys. */
    public static String addressKey(String email) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(email.trim().toLowerCase().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @PreDestroy
    void shutdown() {
        fallbackTimer.shutdown();
    }
}

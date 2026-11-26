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
 * OTP wala email bhejne ka kaam (email khud yahan se nahi jaata, queue me daalte hain).
 *
 * - LEGACY mode: Redis list "mail_queue" me daal do; Bun ka mail worker usse utha ke bhejta hai.
 * - DUAL/KAFKA mode: notification.email.v1 ka outbox row likho; outboxRelay usse Kafka pe daalta hai
 *   aur streams/ ka EmailSender email bhejta hai.
 *
 * Login Kafka ke kharab hone ka wait nahi kar sakta. Isliye 30 second baad bhi row publish nahi hui
 * to core khud row ko "claim" karke Redis queue me daal deta hai. Claim me sent_at set hota hai,
 * isliye email kabhi do baar nahi jaata.
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

    /** OTP email ko line me lagao (mode ke hisaab se Redis ya outbox), aur 30 sec baad fallback check schedule karo. */
    public void queueMail(MailQueueDto data) {
        if (!eventsProperties.mode().producesEvents()) {
            redisTemplate.opsForList().rightPush(mailQueue, data);
            return;
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("to", data.to());
        payload.put("kind", data.subject());
        // Wahi subject aur body jo Bun worker bhejta hai.
        payload.put("subject", data.subject());
        payload.put("body", data.otp());
        payload.put("attempt", 0);
        UUID id = outboxWriter.write(Topics.EMAIL, addressKey(data.to()), payload);

        long delay = eventsProperties.otpFallbackAfter().toMillis();
        fallbackTimer.schedule(() -> fallbackIfUnsent(id, data), delay, TimeUnit.MILLISECONDS);
    }

    /**
     * 30 second baad chalta hai. "WHERE sent_at IS NULL" ke saath UPDATE: agar relay ne pehle hi
     * bhej diya to 0 rows update hongi aur hum kuch nahi karenge. 1 row update hui = humne claim kiya,
     * ab Redis se bhejo. payload khaali kar dete hain taaki OTP DB me na pada rahe.
     */
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

    /** Email events ki Kafka key: email ka SHA-256 hash, taaki asli email address topic keys me na dikhe. */
    public static String addressKey(String email) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(email.trim().toLowerCase().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /** App band hote waqt timer thread rok do. */
    @PreDestroy
    void shutdown() {
        fallbackTimer.shutdown();
    }
}

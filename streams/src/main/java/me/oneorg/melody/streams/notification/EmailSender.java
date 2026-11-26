package me.oneorg.melody.streams.notification;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

import org.apache.avro.specific.SpecificRecord;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.springframework.context.annotation.Profile;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;

import lombok.extern.slf4j.Slf4j;
import me.oneorg.melody.events.EmailRequested;
import me.oneorg.melody.events.Topics;
import tools.jackson.databind.json.JsonMapper;

/**
 * notificationStreams: notification.email.v1 ki har request pe email bhejta hai. Bun mail worker ke Redis loop ki
 * jagah leta hai, same behaviour ke saath: 3 koshish, 5/10/20 second ke gap pe, ek alag retry topic par
 * (taaki ek kharab address baaki emails ko na roke), phir DLQ.
 * Credentials reject hon to seedha DLQ aur 30 second ke liye bhejna band.
 * Body me OTP ho sakta hai: isliye body kabhi log nahi hoti, aur DLQ me bhi nahi jaati.
 */
@Component
@Profile("notification")
@Slf4j
public class EmailSender {

    public static final int MAX_ATTEMPTS = 3;
    static final Duration AUTH_FAILURE_PAUSE = Duration.ofSeconds(30);

    private final MailProvider provider;
    private final KafkaTemplate<String, SpecificRecord> avro;
    private final KafkaTemplate<byte[], byte[]> dlq;
    private final JsonMapper json = JsonMapper.builder().build();
    /** Kaunse event_id:attempt bhej chuke hain - rebalance ke baad dobara aaye to do baar email na jaaye. */
    private final Cache<String, Boolean> sent = Caffeine.newBuilder().maximumSize(100_000)
            .expireAfterWrite(Duration.ofHours(24)).build();

    public EmailSender(MailProvider provider, KafkaTemplate<String, SpecificRecord> avroTemplate,
                       KafkaTemplate<byte[], byte[]> dlqTemplate) {
        this.provider = provider;
        this.avro = avroTemplate;
        this.dlq = dlqTemplate;
    }

    /** Retry ka wait: 5s, 10s, 20s ... max 30s. */
    public static long retryDelayMs(int attempt) {
        return Math.min(5000L * (1L << Math.max(0, attempt - 1)), 30_000L);
    }

    /** notification.email.v1 pe naya email request. */
    @KafkaListener(id = "email", topics = Topics.EMAIL, containerFactory = "emailFactory")
    public void onEmail(ConsumerRecord<String, EmailRequested> record) throws InterruptedException {
        if (record.value() != null) handle(record.key(), record.value());
    }

    /** Retry topic se aaya email: notBefore tak (max 30 sec) ruko, phir bhejo. */
    @KafkaListener(id = "email-retry", topics = Topics.EMAIL_RETRY, containerFactory = "emailRetryFactory")
    public void onRetry(ConsumerRecord<String, EmailRequested> record) throws InterruptedException {
        EmailRequested email = record.value();
        if (email == null) return;
        if (email.getNotBefore() != null) {
            long wait = email.getNotBefore().toEpochMilli() - System.currentTimeMillis();
            if (wait > 0) Thread.sleep(Math.min(wait, 30_000L));
        }
        handle(record.key(), email);
    }

    enum Outcome { SENT, DUPLICATE, RETRY, DLQ }

    Outcome handle(String key, EmailRequested email) throws InterruptedException {
        String dedupeKey = email.getMeta().getEventId() + ":" + email.getAttempt();
        if (sent.getIfPresent(dedupeKey) != null) return Outcome.DUPLICATE;
        try {
            String id = provider.send(email.getTo(), email.getSubject(), email.getBody());
            sent.put(dedupeKey, Boolean.TRUE);
            log.info("Mail sent via {} ({}, kind {}): {}", provider.name(), maskedTo(email.getTo()), email.getKind(), id);
            return Outcome.SENT;
        } catch (Exception e) {
            int attempt = email.getAttempt() + 1;
            if (provider.isAuthError(e)) {
                deadLetter(key, email, attempt, e, "auth");
                log.error("[AUTH FAILURE] {} rejected the credentials; email moved to {}, pausing {}s",
                        provider.name(), Topics.DLQ, AUTH_FAILURE_PAUSE.toSeconds());
                Thread.sleep(AUTH_FAILURE_PAUSE.toMillis());
                return Outcome.DLQ;
            }
            if (attempt >= MAX_ATTEMPTS) {
                deadLetter(key, email, attempt, e, "max_retries");
                log.error("[MAX RETRIES] Email to {} failed {} times; moved to {}", maskedTo(email.getTo()), attempt, Topics.DLQ);
                return Outcome.DLQ;
            }
            long delay = retryDelayMs(attempt);
            EmailRequested retry = EmailRequested.newBuilder(email)
                    .setAttempt(attempt)
                    .setNotBefore(Instant.now().plusMillis(delay))
                    .build();
            avro.send(Topics.EMAIL_RETRY, key, retry);
            log.warn("[RETRY {}/{}] Email to {} in {}s: {}", attempt, MAX_ATTEMPTS, maskedTo(email.getTo()), delay / 1000, e.getMessage());
            return Outcome.RETRY;
        }
    }

    /** Email ko DLQ me bhejo - body ke bina (OTP leak na ho). */
    private void deadLetter(String key, EmailRequested email, int attempts, Exception e, String reason) {
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("to", email.getTo());
        entry.put("kind", email.getKind());
        entry.put("subject", email.getSubject());
        entry.put("retries", attempts);
        String message = String.valueOf(e.getMessage());
        entry.put("error", message.length() > 500 ? message.substring(0, 500) + "…" : message);
        entry.put("reason", reason);
        entry.put("failedAt", Instant.now().toString());
        ProducerRecord<byte[], byte[]> record = new ProducerRecord<>(Topics.DLQ,
                key == null ? null : key.getBytes(StandardCharsets.UTF_8),
                json.writeValueAsBytes(entry));
        record.headers().add("source-topic", Topics.EMAIL.getBytes(StandardCharsets.UTF_8));
        dlq.send(record);
    }

    /** Log ke liye email chhupao: abc@x.com -> a***@x.com. */
    static String maskedTo(String to) {
        int at = to == null ? -1 : to.indexOf('@');
        if (at <= 1) return "***";
        return to.charAt(0) + "***" + to.substring(at);
    }
}

package me.one_org.melody.Events.Kafka;

import me.one_org.melody.Aspects.NoLogging;

import java.time.Duration;

import org.springframework.stereotype.Component;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import me.one_org.melody.Exceptions.TooManyRequestsException;

/**
 * Har user ke liye telemetry ki rate limit (default 300 events / minute).
 *
 * TOKEN BUCKET: har user ki ek "baalti" me 300 tokens. Har event ek token leta hai, aur
 * baalti har minute wapas bharti hai. Tokens khatam = 429 Too Many Requests.
 *
 * Baaltiyan isi server ki memory (Caffeine cache) me hain, Redis me nahi - taaki har telemetry
 * call pe Redis command (aur uska bill) na lage. Har server apni alag limit lagata hai:
 * abuse rokne ke liye ye kaafi hai.
 * 10 minute tak use na hui baalti apne aap hat jaati hai (max 1 lakh users memory me).
 */
@NoLogging
@Component
public class TelemetryRateLimiter {

    private final Cache<String, Bucket> buckets = Caffeine.newBuilder()
            .maximumSize(100_000)
            .expireAfterAccess(Duration.ofMinutes(10))
            .build();
    private final int perMinute;

    public TelemetryRateLimiter(EventsProperties properties) {
        this.perMinute = properties.telemetryPerUserPerMinute();
    }

    /** {@code events} jitne tokens lo, na milein to 429 (TooManyRequestsException). */
    public void consume(String userKey, int events) {
        Bucket bucket = buckets.get(userKey, k -> Bucket.builder()
                .addLimit(Bandwidth.builder().capacity(perMinute).refillGreedy(perMinute, Duration.ofMinutes(1)).build())
                .build());
        if (!bucket.tryConsume(Math.max(1, events))) {
            throw new TooManyRequestsException("Too many events. Please slow down.");
        }
    }
}

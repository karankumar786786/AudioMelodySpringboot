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
 * Per-user token bucket kept in this JVM's memory, so telemetry adds no Redis commands.
 * Each instance limits on its own; that's fine for abuse protection, not for billing.
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

    /** Takes {@code events} tokens or throws 429. */
    public void consume(String userKey, int events) {
        Bucket bucket = buckets.get(userKey, k -> Bucket.builder()
                .addLimit(Bandwidth.builder().capacity(perMinute).refillGreedy(perMinute, Duration.ofMinutes(1)).build())
                .build());
        if (!bucket.tryConsume(Math.max(1, events))) {
            throw new TooManyRequestsException("Too many events. Please slow down.");
        }
    }
}

package me.one_org.melody.Events.Kafka;

import me.one_org.melody.Aspects.NoLogging;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * application.yaml ki melody.events.* settings. Har mode kya karta hai, EventsMode me dekho.
 * Koi value na di ho to neeche ke defaults lagte hain.
 */
@NoLogging
@ConfigurationProperties(prefix = "melody.events")
public record EventsProperties(
        EventsMode mode,
        String source,
        Duration produceTimeout,
        int maxConcurrentSends,
        int maxBatchSize,
        Duration maxClockSkew,
        int telemetryPerUserPerMinute,
        Duration otpFallbackAfter) {

    public EventsProperties {
        if (mode == null) mode = EventsMode.LEGACY;                         // default: Kafka band
        if (source == null || source.isBlank()) source = "core-api";
        if (produceTimeout == null) produceTimeout = Duration.ofSeconds(3); // KAFKA mode me ack ka max wait
        if (maxConcurrentSends <= 0) maxConcurrentSends = 64;              // bulkhead ki limit
        if (maxBatchSize <= 0) maxBatchSize = 50;                          // ek batch me max events
        if (maxClockSkew == null) maxClockSkew = Duration.ofHours(24);     // phone ki ghadi kitni galat chal sakti hai
        if (telemetryPerUserPerMinute <= 0) telemetryPerUserPerMinute = 300; // rate limit
        if (otpFallbackAfter == null) otpFallbackAfter = Duration.ofSeconds(30); // OTP email Kafka se na jaaye to itne baad Redis se
    }
}

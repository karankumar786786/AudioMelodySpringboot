package me.one_org.melody.Events.Kafka;

import me.one_org.melody.Aspects.NoLogging;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** melody.events.* settings. See EventsMode for what each mode does. */
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
        if (mode == null) mode = EventsMode.LEGACY;
        if (source == null || source.isBlank()) source = "core-api";
        if (produceTimeout == null) produceTimeout = Duration.ofSeconds(3);
        if (maxConcurrentSends <= 0) maxConcurrentSends = 64;
        if (maxBatchSize <= 0) maxBatchSize = 50;
        if (maxClockSkew == null) maxClockSkew = Duration.ofHours(24);
        if (telemetryPerUserPerMinute <= 0) telemetryPerUserPerMinute = 300;
        if (otpFallbackAfter == null) otpFallbackAfter = Duration.ofSeconds(30);
    }
}

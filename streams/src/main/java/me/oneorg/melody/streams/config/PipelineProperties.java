package me.oneorg.melody.streams.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** melody.streams.* settings - saari stream services ke liye common. */
@ConfigurationProperties(prefix = "melody.streams")
public record PipelineProperties(
        String schemaRegistryUrl,
        String stateDir,
        int replicationFactor,
        /** Plays ko user_history aur stream counts me likho (tab on karo jab core API KAFKA mode me ho). */
        boolean historySinkEnabled,
        /** Interactions Recombee aur Algolia ko bhejo (tab on karo jab core API KAFKA mode me ho). */
        boolean syncEnabled,
        /** Artist naya gaana laaye to followers ko email bhejo. */
        boolean newReleaseEmailsEnabled,
        Duration outboxSafetySweep,
        Duration sessionGap) {

    public PipelineProperties {
        if (schemaRegistryUrl == null || schemaRegistryUrl.isBlank()) schemaRegistryUrl = "http://localhost:18081";
        if (stateDir == null || stateDir.isBlank()) stateDir = "/tmp/kafka-streams";
        if (replicationFactor <= 0) replicationFactor = 1;
        if (outboxSafetySweep == null) outboxSafetySweep = Duration.ofHours(6);
        if (sessionGap == null) sessionGap = Duration.ofMinutes(30);
    }
}

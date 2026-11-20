package me.oneorg.melody.streams.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** melody.streams.* settings shared by the stream services. */
@ConfigurationProperties(prefix = "melody.streams")
public record PipelineProperties(
        String schemaRegistryUrl,
        String stateDir,
        int replicationFactor,
        /** Write plays into user_history and stream counts (enable when the core API runs in KAFKA mode). */
        boolean historySinkEnabled,
        /** Send interactions to Recombee and Algolia (enable when the core API runs in KAFKA mode). */
        boolean syncEnabled,
        /** Email followers when an artist releases a song. */
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

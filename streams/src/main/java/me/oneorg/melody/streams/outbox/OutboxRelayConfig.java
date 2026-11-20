package me.oneorg.melody.streams.outbox;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;

import me.oneorg.melody.streams.config.KafkaPipelineConfig;

@Configuration
@Profile("outbox-relay")
public class OutboxRelayConfig {

    /** Wake-up records are plain strings; a burst of them becomes one sweep. */
    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, Object> wakeupFactory(
            KafkaPipelineConfig config, DeadLetterPublishingRecoverer recoverer) {
        ConcurrentKafkaListenerContainerFactory<String, Object> f = config.batchFactory("melody-outbox-relay", false, 100, recoverer);
        f.getContainerProperties().setPollTimeout(5000);
        return f;
    }
}

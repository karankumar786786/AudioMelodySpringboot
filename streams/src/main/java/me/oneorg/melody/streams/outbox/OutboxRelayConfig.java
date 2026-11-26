package me.oneorg.melody.streams.outbox;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;

import me.oneorg.melody.streams.config.KafkaPipelineConfig;

@Configuration
@Profile("outbox-relay")
/**
 * outbox-relay profile ki Kafka setting (wake-up topic ka listener).
 */
public class OutboxRelayConfig {

    /** Wake-up messages simple strings hain; ek saath bahut aayein to bhi ek hi sweep chalta hai. */
    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, Object> wakeupFactory(
            KafkaPipelineConfig config, DeadLetterPublishingRecoverer recoverer) {
        ConcurrentKafkaListenerContainerFactory<String, Object> f = config.batchFactory("melody-outbox-relay", false, 100, recoverer);
        f.getContainerProperties().setPollTimeout(5000);
        return f;
    }
}

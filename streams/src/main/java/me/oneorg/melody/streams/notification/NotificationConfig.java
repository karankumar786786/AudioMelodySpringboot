package me.oneorg.melody.streams.notification;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;

import me.oneorg.melody.streams.config.KafkaPipelineConfig;

@Configuration
@Profile("notification")
public class NotificationConfig {

    @Bean
    public MailProvider mailProvider() {
        return MailProviders.fromEnv(System.getenv());
    }

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, Object> emailFactory(
            KafkaPipelineConfig config, DeadLetterPublishingRecoverer recoverer) {
        return config.recordFactory("melody-notification", true, recoverer);
    }

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, Object> emailRetryFactory(
            KafkaPipelineConfig config, DeadLetterPublishingRecoverer recoverer) {
        return config.recordFactory("melody-notification-retry", true, recoverer);
    }

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, Object> releaseFactory(
            KafkaPipelineConfig config, DeadLetterPublishingRecoverer recoverer) {
        return config.recordFactory("melody-new-release", true, recoverer);
    }
}

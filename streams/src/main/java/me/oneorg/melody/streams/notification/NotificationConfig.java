package me.oneorg.melody.streams.notification;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;

import me.oneorg.melody.streams.config.KafkaPipelineConfig;

@Configuration
@Profile("notification")
/**
 * notification profile ki setting: mail provider aur email listeners ke factories.
 */
public class NotificationConfig {

    /** Env se mail provider. */
    @Bean
    public MailProvider mailProvider() {
        return MailProviders.fromEnv(System.getenv());
    }

    /** Naye emails ka listener. */
    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, Object> emailFactory(
            KafkaPipelineConfig config, DeadLetterPublishingRecoverer recoverer) {
        return config.recordFactory("melody-notification", true, recoverer);
    }

    /** Retry emails ka listener. */
    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, Object> emailRetryFactory(
            KafkaPipelineConfig config, DeadLetterPublishingRecoverer recoverer) {
        return config.recordFactory("melody-notification-retry", true, recoverer);
    }

    /** catalog.song.v1 (naye gaane) ka listener. */
    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, Object> releaseFactory(
            KafkaPipelineConfig config, DeadLetterPublishingRecoverer recoverer) {
        return config.recordFactory("melody-new-release", true, recoverer);
    }
}

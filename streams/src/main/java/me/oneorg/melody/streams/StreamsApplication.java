package me.oneorg.melody.streams;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * One deployable for the event pipeline's consumers. SPRING_PROFILES_ACTIVE picks the
 * services this container runs: outbox-relay, stats, activity, sync, notification.
 */
@SpringBootApplication
@EnableScheduling
@ConfigurationPropertiesScan
public class StreamsApplication {
    public static void main(String[] args) {
        SpringApplication.run(StreamsApplication.class, args);
    }
}

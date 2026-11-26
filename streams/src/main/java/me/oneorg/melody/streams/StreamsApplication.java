package me.oneorg.melody.streams;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Event pipeline ke saare consumers ka ek hi app (Spring Boot).
 * SPRING_PROFILES_ACTIVE (ya STREAMS_PROFILES) batata hai ki ye container kaunsi services chalaye:
 * outbox-relay, stats, activity, sync, notification, analytics.
 * Har profile ek alag kaam hai - ek hi JAR, alag alag on/off.
 */
@SpringBootApplication
@EnableScheduling
@ConfigurationPropertiesScan
public class StreamsApplication {
    /** Yahan se streams app start hota hai. */
    public static void main(String[] args) {
        SpringApplication.run(StreamsApplication.class, args);
    }
}

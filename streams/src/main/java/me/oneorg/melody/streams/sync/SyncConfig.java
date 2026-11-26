package me.oneorg.melody.streams.sync;

import java.time.Duration;
import java.util.concurrent.Executors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;

import com.algolia.api.SearchClient;
import com.algolia.config.ClientOptions;
import com.recombee.api_client.RecombeeClient;
import com.recombee.api_client.util.Region;

import me.oneorg.melody.streams.config.KafkaPipelineConfig;

@Configuration
@Profile("sync")
/**
 * sync profile ki setting: Recombee aur Algolia clients, aur batch listener.
 */
public class SyncConfig {

    /** Recombee client. */
    @Bean
    public RecombeeClient recombeeClient(@Value("${recombee.database-id}") String databaseId,
                                         @Value("${recombee.secret-token}") String secretToken,
                                         @Value("${recombee.region:EU_WEST}") String region) {
        return new RecombeeClient(databaseId, secretToken).setRegion(Region.valueOf(region));
    }

    /** Algolia client. */
    @Bean
    public SearchClient searchClient(@Value("${algolia.app-id}") String appId, @Value("${algolia.api-key}") String apiKey) {
        ClientOptions options = ClientOptions.builder()
                .setConnectTimeout(Duration.ofSeconds(2))
                .setReadTimeout(Duration.ofSeconds(5))
                .setWriteTimeout(Duration.ofSeconds(5))
                .setExecutor(Executors.newVirtualThreadPerTaskExecutor())
                .build();
        return new SearchClient(appId, apiKey, options);
    }

    /** Har poll 5 second tak wait karta hai, taaki Recombee aur Algolia ki har call me ek batch jaaye. */
    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, Object> syncFactory(
            KafkaPipelineConfig config, DeadLetterPublishingRecoverer recoverer) {
        return config.batchFactory("melody-sync", true, 5000, recoverer);
    }
}

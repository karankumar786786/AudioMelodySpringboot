package me.one_org.melody.Configuration;

import java.time.Duration;
import java.util.concurrent.Executors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.algolia.api.SearchClient;
import com.algolia.config.ClientOptions;

@Configuration
public class AlgoliaSearchConfig {
    @Value("${algolia.app-id}")
    private String appId;
    @Value("${algolia.api-key}")
    private String apiKey;

    @Bean
    public SearchClient searchClient() {
        ClientOptions options = ClientOptions.builder()
                .setConnectTimeout(Duration.ofSeconds(2))
                .setReadTimeout(Duration.ofSeconds(3))
                .setWriteTimeout(Duration.ofSeconds(3))
                .setExecutor(Executors.newVirtualThreadPerTaskExecutor())
                .build();
        return new SearchClient(appId, apiKey, options);
    }
}

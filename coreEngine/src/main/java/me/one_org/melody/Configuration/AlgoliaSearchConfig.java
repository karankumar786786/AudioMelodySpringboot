package me.one_org.melody.Configuration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.algolia.api.SearchClient;

@Configuration
public class AlgoliaSearchConfig {
    @Value("${algolia.app-id}")
    private String appId;
    @Value("${algolia.api-key}")
    private String apiKey;

    @Bean
    public SearchClient searchClient() {
        return new SearchClient(appId, apiKey);
    }
}

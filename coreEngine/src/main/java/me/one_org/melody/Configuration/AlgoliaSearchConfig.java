package me.one_org.melody.Configuration;

import java.time.Duration;
import java.util.concurrent.Executors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.algolia.api.SearchClient;
import com.algolia.config.ClientOptions;

/**
 * Algolia (search service) ka client banata hai.
 * Search bar me jo bhi type karte ho, wo query Algolia pe jaati hai.
 * App id aur API key application.yaml / env se aate hain.
 */
@Configuration
public class AlgoliaSearchConfig {
    @Value("${algolia.app-id}")
    private String appId;
    @Value("${algolia.api-key}")
    private String apiKey;

    /**
     * Algolia SearchClient bean.
     * Timeouts chhote rakhe hain (2-3 second) taaki Algolia slow ho to bhi
     * hamari API zyada der latki na rahe. Virtual threads use karte hain
     * jo bahut halke hote hain, isliye bahut saari requests saath chal sakti hain.
     */
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

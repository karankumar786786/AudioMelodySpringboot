package me.one_org.melody.Configuration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.recombee.api_client.RecombeeClient;
import com.recombee.api_client.util.Region;

@Configuration
public class RecombeeConfig {
    @Value("${recombee.database-id}")
    private String databaseId;
    @Value("${recombee.secret-token}")
    private String secretToken;

    @Value("${recombee.region}")
    private String region;

    @Bean
    public RecombeeClient recombeeClient(){
        return new RecombeeClient(databaseId, secretToken).setRegion(Region.EU_WEST);
    }
}

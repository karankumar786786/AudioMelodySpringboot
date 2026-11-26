package me.one_org.melody.Configuration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.recombee.api_client.RecombeeClient;
import com.recombee.api_client.util.Region;

/**
 * Recombee (recommendation service) ka client banata hai.
 * "Similar songs", "For you" jaise suggestions Recombee se aate hain.
 */
@Configuration
public class RecombeeConfig {
    @Value("${recombee.database-id}")
    private String databaseId;
    @Value("${recombee.secret-token}")
    private String secretToken;

    // Dhyan do: ye value padhi jaati hai par abhi use nahi hoti -
    // neeche region seedha EU_WEST fix hai.
    @Value("${recombee.region}")
    private String region;

    /** RecombeeClient bean, EU West region ke server se baat karta hai. */
    @Bean
    public RecombeeClient recombeeClient(){
        return new RecombeeClient(databaseId, secretToken).setRegion(Region.EU_WEST);
    }
}

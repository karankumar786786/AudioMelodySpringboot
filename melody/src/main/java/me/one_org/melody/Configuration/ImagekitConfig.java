package me.one_org.melody.Configuration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;


import io.imagekit.sdk.ImageKit;

@Configuration
public class ImagekitConfig {
    @Value("${IMAGEKIT_PUBLIC_KEY}")
    private String publicKey;
    @Value("${IMAGEKIT_PRIVATE_KEY}")
    private String privateKey;
    @Value("${IMAGEKIT_URL_ENDPOINT}")
    private String urlEndpoint;

    @Bean
    public ImageKit imageKitSdk(){
        ImageKit imageKit = ImageKit.getInstance();
        io.imagekit.sdk.config.Configuration config = new io.imagekit.sdk.config.Configuration(publicKey, privateKey, urlEndpoint);
        imageKit.setConfig(config);
        return imageKit;
    }
}

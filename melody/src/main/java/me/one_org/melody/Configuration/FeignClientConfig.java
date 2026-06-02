package me.one_org.melody.Configuration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import feign.RequestInterceptor;

@Configuration
public class FeignClientConfig {
    @Value("${audio-processing.api.key}")
    private String apiKey;

    @Bean
    public RequestInterceptor requestInterceptor(){
        return template -> template.header("X-API-KEY", apiKey);
    }
}

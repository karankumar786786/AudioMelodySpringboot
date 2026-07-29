package me.one_org.melody.Configuration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import feign.RequestInterceptor;
import feign.codec.ErrorDecoder;
import feign.RetryableException;

@Configuration
public class FeignClientConfig {
    @Value("${audio-processing.api.key}")
    private String apiKey;

    @Bean
    public RequestInterceptor requestInterceptor() {
        return template -> template.header("X-API-KEY", apiKey);
    }

    @Bean
    public ErrorDecoder errorDecoder() {
        return (methodKey, response) -> {
            if (response.status() == 429 || response.status() == 503) {
                return new RetryableException(
                        response.status(),
                        "Retryable error: " + response.status(),
                        response.request().httpMethod(),
                        (Long) null, // explicit Long cast resolves ambiguity
                        response.request());
            }
            return new ErrorDecoder.Default().decode(methodKey, response);
        };
    }
}

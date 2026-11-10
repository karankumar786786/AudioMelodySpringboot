package me.one_org.melody.Configuration;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import me.one_org.melody.Security.ClientInfoArgumentResolver;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final ClientInfoArgumentResolver clientInfoArgumentResolver;

    public WebMvcConfig(ClientInfoArgumentResolver clientInfoArgumentResolver) {
        this.clientInfoArgumentResolver = clientInfoArgumentResolver;
    }

    @Bean
    @Primary
    public ObjectMapper objectMapper() {
        return new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(clientInfoArgumentResolver);
    }
}

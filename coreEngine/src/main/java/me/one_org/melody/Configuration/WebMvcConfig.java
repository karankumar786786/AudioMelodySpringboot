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

/**
 * Spring MVC (web layer) ki extra settings.
 * 1. Ek default ObjectMapper (JSON <-> Java object converter) deta hai.
 * 2. ClientInfoArgumentResolver register karta hai, taaki controller methods
 *    ko device / IP jaisi client info seedha parameter me mil jaaye.
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final ClientInfoArgumentResolver clientInfoArgumentResolver;

    public WebMvcConfig(ClientInfoArgumentResolver clientInfoArgumentResolver) {
        this.clientInfoArgumentResolver = clientInfoArgumentResolver;
    }

    /**
     * Main ObjectMapper.
     * - JavaTimeModule: Instant / LocalDate jaise date types ko JSON me sahi se likhta hai.
     * - FAIL_ON_UNKNOWN_PROPERTIES = false: client koi extra field bheje to error nahi,
     *   bas us field ko ignore kar do (purane / naye app versions ke liye safe).
     */
    @Bean
    @Primary
    public ObjectMapper objectMapper() {
        return new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }

    /** Hamara custom argument resolver Spring ki list me jod deta hai. */
    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(clientInfoArgumentResolver);
    }
}

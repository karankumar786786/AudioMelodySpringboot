package me.one_org.melody.Configuration;

import java.util.List;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import me.one_org.melody.Security.ClientInfoArgumentResolver;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final ClientInfoArgumentResolver clientInfoArgumentResolver;

    public WebMvcConfig(ClientInfoArgumentResolver clientInfoArgumentResolver) {
        this.clientInfoArgumentResolver = clientInfoArgumentResolver;
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(clientInfoArgumentResolver);
    }
}

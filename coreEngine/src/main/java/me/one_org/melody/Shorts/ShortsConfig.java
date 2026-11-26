package me.one_org.melody.Shorts;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * ShortsProperties (melody.shorts.* settings) ko Spring me register karta hai.
 */
@Configuration
@EnableConfigurationProperties(ShortsProperties.class)
public class ShortsConfig {
}

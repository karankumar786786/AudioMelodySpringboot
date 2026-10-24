package me.one_org.melody.Configuration;

import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJacksonJsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.cfg.DateTimeFeature;

import java.util.HashMap;
import java.util.Map;

@Configuration
public class RedisConfig implements CachingConfigurer {

    private static final Logger log = LoggerFactory.getLogger(RedisConfig.class);

    private GenericJacksonJsonRedisSerializer createJsonRedisSerializer() {
        return GenericJacksonJsonRedisSerializer.builder()
                .enableSpringCacheNullValueSupport()
                .customize(builder -> builder
                        .disable(DateTimeFeature.WRITE_DATES_AS_TIMESTAMPS)
                        .disable(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES)
                        .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES))
                .build();
    }

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);

        StringRedisSerializer stringSerializer = new StringRedisSerializer();
        GenericJacksonJsonRedisSerializer jacksonSerializer = createJsonRedisSerializer();

        // Use String serializer for keys and hash keys
        template.setKeySerializer(stringSerializer);
        template.setHashKeySerializer(stringSerializer);
        // Use Jackson 3 JSON serializer with null value support
        template.setValueSerializer(jacksonSerializer);
        template.setHashValueSerializer(jacksonSerializer);
        template.afterPropertiesSet();
        return template;
    }

    @Bean
    public CacheManager cacheManager(RedisConnectionFactory factory) {
        GenericJacksonJsonRedisSerializer serializer = createJsonRedisSerializer();

        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration
                .defaultCacheConfig()
                .computePrefixWith(cacheName -> "v3:" + cacheName + "::")
                .entryTtl(Duration.ofMinutes(10))
                .serializeKeysWith(
                        RedisSerializationContext.SerializationPair.fromSerializer(
                                new StringRedisSerializer()
                        )
                )
                .serializeValuesWith(
                        RedisSerializationContext.SerializationPair.fromSerializer(serializer)
                );

        Map<String, RedisCacheConfiguration> cacheConfigurations = new HashMap<>();
        cacheConfigurations.put("songs", defaultConfig.entryTtl(Duration.ofMinutes(30)));
        cacheConfigurations.put("featured_songs", defaultConfig.entryTtl(Duration.ofMinutes(15)));
        cacheConfigurations.put("artists", defaultConfig.entryTtl(Duration.ofMinutes(30)));
        cacheConfigurations.put("playlists", defaultConfig.entryTtl(Duration.ofMinutes(15)));
        cacheConfigurations.put("artist_lists", defaultConfig.entryTtl(Duration.ofMinutes(15)));
        cacheConfigurations.put("playlist_lists", defaultConfig.entryTtl(Duration.ofMinutes(15)));
        cacheConfigurations.put("artist_songs", defaultConfig.entryTtl(Duration.ofMinutes(15)));
        cacheConfigurations.put("paginationMetaData", defaultConfig.entryTtl(Duration.ofMinutes(5)));

        return RedisCacheManager.builder(factory)
                .cacheDefaults(defaultConfig)
                .withInitialCacheConfigurations(cacheConfigurations)
                .build();
    }

    @Override
    @Bean
    public CacheErrorHandler errorHandler() {
        return new CacheErrorHandler() {
            @Override
            public void handleCacheGetError(RuntimeException exception, Cache cache, Object key) {
                log.warn("Redis cache GET failed for cache='{}', key='{}'. Evicting stale entry and falling back to DB: {}",
                        cache != null ? cache.getName() : "unknown", key, exception.getMessage());
                if (cache != null) {
                    try {
                        cache.evict(key);
                    } catch (Exception e) {
                        log.warn("Failed to evict stale cache key '{}' from '{}': {}", key, cache.getName(), e.getMessage());
                    }
                }
            }

            @Override
            public void handleCachePutError(RuntimeException exception, Cache cache, Object key, Object value) {
                log.warn("Redis cache PUT failed for cache='{}', key='{}'. Continuing without caching: {}",
                        cache != null ? cache.getName() : "unknown", key, exception.getMessage());
            }

            @Override
            public void handleCacheEvictError(RuntimeException exception, Cache cache, Object key) {
                log.warn("Redis cache EVICT failed for cache='{}', key='{}': {}",
                        cache != null ? cache.getName() : "unknown", key, exception.getMessage());
            }

            @Override
            public void handleCacheClearError(RuntimeException exception, Cache cache) {
                log.warn("Redis cache CLEAR failed for cache='{}': {}",
                        cache != null ? cache.getName() : "unknown", exception.getMessage());
            }
        };
    }
}

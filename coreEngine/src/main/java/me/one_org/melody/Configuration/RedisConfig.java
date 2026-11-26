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

/**
 * Redis cache ki poori setting yahan hai.
 *
 * Caching ka idea: jo data baar baar maanga jaata hai (jaise trending songs), usko
 * pehli baar DB se laake Redis me rakh lo. Agli baar Redis se do - bahut fast.
 * Services me @Cacheable("songs") jaise annotations isi CacheManager ko use karte hain.
 *
 * Har cache ki key aisi dikhti hai: "v4:songs::<id>". "v4" version hai - format badle
 * to version badha do, purani keys apne aap ignore ho jaayengi.
 *
 * Agar Redis down ho jaaye to errorHandler() request fail nahi hone deta,
 * seedha DB se data aa jaata hai (bas thoda slow).
 */
@Configuration
public class RedisConfig implements CachingConfigurer {

    private static final Logger log = LoggerFactory.getLogger(RedisConfig.class);

    // Saare caches ki key ke aage ye version lagta hai.
    private static final String CACHE_KEY_VERSION = "v4:";
    // Jis cache ki apni TTL set nahi hai, uska data itni der tak rehta hai.
    private static final Duration DEFAULT_TTL = Duration.ofMinutes(10);

    /**
     * Java object <-> JSON converter jo Redis me value likhne/padhne ke kaam aata hai.
     * - "@class" field JSON me likhte hain taaki wapas padhte waqt pata ho ki kaunsi class banani hai.
     * - Spring cache "null" result bhi cache kar sake, uska support on hai.
     * - Unknown fields ya null primitives pe crash nahi karta (code badalne pe purana cache safe rahe).
     */
    private GenericJacksonJsonRedisSerializer createJsonRedisSerializer() {
        return GenericJacksonJsonRedisSerializer.builder()
                .enableSpringCacheNullValueSupport()
                .enableUnsafeDefaultTyping()
                .typePropertyName("@class")
                .writer((mapper, source) -> {
                    // List.of() / Set.of() jaise immutable collections ka "@class" wapas
                    // padhte waqt ban nahi paata, isliye likhne se pehle unko normal
                    // ArrayList / LinkedHashSet me copy kar dete hain.
                    Object target = source;
                    if (source instanceof java.util.List<?> list && !(source instanceof java.util.ArrayList<?>)) {
                        target = new java.util.ArrayList<>(list);
                    } else if (source instanceof java.util.Set<?> set && !(source instanceof java.util.LinkedHashSet<?>)) {
                        target = new java.util.LinkedHashSet<>(set);
                    }
                    try {
                        return mapper.writeValueAsBytes(target);
                    } catch (Exception e) {
                        throw new org.springframework.data.redis.serializer.SerializationException("Could not write JSON: " + e.getMessage(), e);
                    }
                })
                .customize(builder -> builder
                        .disable(DateTimeFeature.WRITE_DATES_AS_TIMESTAMPS)
                        .disable(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES)
                        .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES))
                .build();
    }

    /**
     * Generic RedisTemplate: key String me, value JSON me.
     * Jo code seedha Redis use karta hai (cache annotation ke bina), wo isko use karta hai.
     */
    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);

        StringRedisSerializer stringSerializer = new StringRedisSerializer();
        GenericJacksonJsonRedisSerializer jacksonSerializer = createJsonRedisSerializer();

        // Keys (aur hash ki keys) simple string rahengi, taaki redis-cli me padh sako.
        template.setKeySerializer(stringSerializer);
        template.setHashKeySerializer(stringSerializer);
        // Values JSON me jaayengi.
        template.setValueSerializer(jacksonSerializer);
        template.setHashValueSerializer(jacksonSerializer);
        template.afterPropertiesSet();
        return template;
    }

    /**
     * Spring ka CacheManager - @Cacheable isi se baat karta hai.
     * Default TTL 10 minute, aur kuch caches ki apni alag TTL hai (cacheTtls() dekho).
     */
    @Bean
    public CacheManager cacheManager(RedisConnectionFactory factory) {
        RedisCacheConfiguration defaultConfig = defaultCacheConfig();
        return RedisCacheManager.builder(factory)
                .cacheDefaults(defaultConfig)
                .withInitialCacheConfigurations(cacheTtls(defaultConfig))
                .build();
    }

    /** Sab caches ki common setting: key prefix, default TTL, key string me, value JSON me. */
    private RedisCacheConfiguration defaultCacheConfig() {
        GenericJacksonJsonRedisSerializer serializer = createJsonRedisSerializer();
        return RedisCacheConfiguration.defaultCacheConfig()
                .computePrefixWith(cacheName -> CACHE_KEY_VERSION + cacheName + "::")
                .entryTtl(DEFAULT_TTL)
                .serializeKeysWith(
                        RedisSerializationContext.SerializationPair.fromSerializer(
                                new StringRedisSerializer()
                        )
                )
                .serializeValuesWith(
                        RedisSerializationContext.SerializationPair.fromSerializer(serializer)
                );
    }

    /**
     * Har cache kitni der tak valid rahega.
     * Jo data kam badalta hai (song details, lyrics) wo zyada der, jo jaldi badalta hai
     * (trending, pagination counts) wo kam der.
     */
    private Map<String, RedisCacheConfiguration> cacheTtls(RedisCacheConfiguration defaultConfig) {
        Map<String, RedisCacheConfiguration> ttls = new HashMap<>();
        ttls.put("songs", defaultConfig.entryTtl(Duration.ofMinutes(30)));
        ttls.put("featured_songs", defaultConfig.entryTtl(Duration.ofMinutes(15)));
        ttls.put("artists", defaultConfig.entryTtl(Duration.ofMinutes(30)));
        ttls.put("playlists", defaultConfig.entryTtl(Duration.ofMinutes(15)));
        ttls.put("artist_lists", defaultConfig.entryTtl(Duration.ofMinutes(15)));
        ttls.put("playlist_lists", defaultConfig.entryTtl(Duration.ofMinutes(15)));
        ttls.put("artist_songs", defaultConfig.entryTtl(Duration.ofMinutes(15)));
        ttls.put("trending_songs", defaultConfig.entryTtl(Duration.ofMinutes(10)));
        ttls.put("trending_videos", defaultConfig.entryTtl(Duration.ofMinutes(10)));
        ttls.put("popular_videos", defaultConfig.entryTtl(Duration.ofMinutes(15)));
        ttls.put("related_videos", defaultConfig.entryTtl(Duration.ofMinutes(15)));
        ttls.put("lyrics", defaultConfig.entryTtl(Duration.ofDays(30)));
        ttls.put("canvas_featured", defaultConfig.entryTtl(Duration.ofMinutes(15)));
        ttls.put("paginationMetaData", defaultConfig.entryTtl(Duration.ofMinutes(5)));
        return ttls;
    }

    /**
     * Redis fail ho jaaye to kya karna hai.
     * Har case me hum sirf warning log karte hain aur request ko chalne dete hain:
     * - GET fail: kharab entry hata do, aur data DB se lao.
     * - PUT fail: cache me save nahi hua, koi baat nahi, response to ban gaya.
     * - EVICT / CLEAR fail: bas log kar do.
     */
    @Override
    @Bean
    public CacheErrorHandler errorHandler() {
        return new CacheErrorHandler() {
            @Override
            public void handleCacheGetError(RuntimeException exception, Cache cache, Object key) {
                log.warn("Redis cache GET failed for cache='{}', key='{}'. Evicting stale entry and falling back to DB: {}",
                        cacheName(cache), key, exception.getMessage());
                if (cache == null) {
                    return;
                }
                // Shayad entry kharab (purane format ki) hai - hata do taaki agli baar fresh bane.
                try {
                    cache.evict(key);
                } catch (Exception e) {
                    log.warn("Failed to evict stale cache key '{}' from '{}': {}", key, cache.getName(), e.getMessage());
                }
            }

            @Override
            public void handleCachePutError(RuntimeException exception, Cache cache, Object key, Object value) {
                log.warn("Redis cache PUT failed for cache='{}', key='{}'. Continuing without caching: {}",
                        cacheName(cache), key, exception.getMessage());
            }

            @Override
            public void handleCacheEvictError(RuntimeException exception, Cache cache, Object key) {
                log.warn("Redis cache EVICT failed for cache='{}', key='{}': {}",
                        cacheName(cache), key, exception.getMessage());
            }

            @Override
            public void handleCacheClearError(RuntimeException exception, Cache cache) {
                log.warn("Redis cache CLEAR failed for cache='{}': {}",
                        cacheName(cache), exception.getMessage());
            }
        };
    }

    /** Log ke liye cache ka naam; cache null ho to "unknown". */
    private static String cacheName(Cache cache) {
        return cache != null ? cache.getName() : "unknown";
    }
}

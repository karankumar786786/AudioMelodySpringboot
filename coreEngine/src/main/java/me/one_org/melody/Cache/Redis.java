package me.one_org.melody.Cache;

import java.time.Duration;
import java.util.Optional;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import tools.jackson.databind.ObjectMapper;

@Component
public class Redis<T> {

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public Redis(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    private String group;
    private Class<T> type;

    public Redis<T> of(String group, Class<T> type) {
        this.group = group;
        this.type = type;
        return this;
    }

    private String buildKey(String key) {
        return group != null ? group + ":" + key : key;
    }

    public void set(String key, T value) {
        try {
            String json = objectMapper.writeValueAsString(value);
            redisTemplate.opsForValue().set(buildKey(key), json);
        } catch (Exception e) {
            throw new RuntimeException("Redis serialization error", e);
        }
    }

    public void set(String key, T value, Duration ttl) {
        try {
            String json = objectMapper.writeValueAsString(value);
            redisTemplate.opsForValue().set(buildKey(key), json, ttl);
        } catch (Exception e) {
            throw new RuntimeException("Redis serialization error", e);
        }
    }

    public Optional<T> get(String key) {
        String json = redisTemplate.opsForValue().get(buildKey(key));
        if (json == null || json.isBlank()) return Optional.empty();
        try {
            return Optional.of(objectMapper.readValue(json, type));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    public boolean delete(String key) {
        return Boolean.TRUE.equals(redisTemplate.delete(buildKey(key)));
    }

    public void deleteIfExists(String key) {
        redisTemplate.delete(buildKey(key));
    }

    public boolean exists(String key) {
        return Boolean.TRUE.equals(redisTemplate.hasKey(buildKey(key)));
    }
}
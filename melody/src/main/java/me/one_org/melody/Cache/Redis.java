package me.one_org.melody.Cache;

import java.util.Optional;
import java.util.concurrent.TimeUnit;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

@Component
public class Redis<T> {

    
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    private String group;
    private Class<T> type;

    public Redis<T> of(String group, Class<T> type) {
        this.group = group;
        this.type = type;
        return this;
    }

    private String buildKey(String key) {
        return group + ":" + key;
    }

    public void set(String key, T value) {
        redisTemplate.opsForValue().set(buildKey(key), value);
    }

    public void set(String key, T value, long timeout, TimeUnit unit) {
        redisTemplate.opsForValue().set(buildKey(key), value, timeout, unit);
    }

    @SuppressWarnings("unchecked")
    public Optional<T> get(String key) {
        Object value = redisTemplate.opsForValue().get(buildKey(key));
        if (value == null) return Optional.empty();
        if (type.isInstance(value)) return Optional.of((T) value);
        return Optional.empty();
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
package me.one_org.melody.Cache;

import java.util.Optional;
import java.util.concurrent.TimeUnit;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

@Component
public class Redis<T> {

    
    private final RedisTemplate<String, Object> redisTemplate;

    public Redis(RedisTemplate<String,Object> redisTemplate){
        this.redisTemplate = redisTemplate;
    }

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

    @SuppressWarnings("null")
    public void set(String key, T value) {
        redisTemplate.opsForValue().set(buildKey(key), value);
    }
     @SuppressWarnings("null")
    public void set(String key, T value, long timeout, TimeUnit unit) {
        redisTemplate.opsForValue().set(buildKey(key), value, timeout, unit);
    }


    @SuppressWarnings({ "unchecked", "null" })
    public Optional<T> get(String key) {
        Object value = redisTemplate.opsForValue().get(buildKey(key));
        if (value == null) return Optional.empty();
        if (type.isInstance(value)) return Optional.of((T) value);
        return Optional.empty();
    }
     @SuppressWarnings("null")
    public boolean delete(String key) {
        return Boolean.TRUE.equals(redisTemplate.delete(buildKey(key)));
    }
     @SuppressWarnings("null")
    public void deleteIfExists(String key) {
        redisTemplate.delete(buildKey(key));
    }
     @SuppressWarnings("null")
    public boolean exists(String key) {
        return Boolean.TRUE.equals(redisTemplate.hasKey(buildKey(key)));
    }
}
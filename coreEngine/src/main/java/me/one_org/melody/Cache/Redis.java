package me.one_org.melody.Cache;

import java.time.Duration;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import tools.jackson.databind.ObjectMapper;

/**
 * Redis ke upar ek chhota sa helper (wrapper), taaki baaki code ko Redis ki
 * detail na jaanni pade.
 *
 * Kaise use karte hain:
 *   Redis<OtpData> otpStore = redis.of("otp", OtpData.class);
 *   otpStore.set("abc@gmail.com", data, Duration.ofMinutes(5));
 *
 * - "group" key ke aage prefix ban jaata hai, to asli Redis key "otp:abc@gmail.com" hogi.
 * - Value ko JSON string bana ke save karte hain, aur padhte waqt wapas object banate hain.
 *
 * Isko AuthenticationService (OTP, rotated tokens) jaise services use karti hain.
 */
@Component
public class Redis<T> {

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    // Key ka prefix (jaise "otp"). null ho to key waise hi use hoti hai.
    private final String group;
    // Kis class ka object store kar rahe hain - JSON wapas object banane me kaam aata hai.
    private final Class<T> type;

    /** Spring is constructor se ek "base" Redis bean banata hai (bina group ke). */
    @Autowired
    public Redis(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this(redisTemplate, objectMapper, null, null);
    }

    private Redis(StringRedisTemplate redisTemplate, ObjectMapper objectMapper, String group, Class<T> type) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
        this.group = group;
        this.type = type;
    }

    /**
     * Ek naya helper banata hai jo ek fixed group (prefix) aur ek fixed type ke liye kaam kare.
     * Input: group = key prefix, type = value ki class. Output: naya Redis<N> object.
     */
    public <N> Redis<N> of(String group, Class<N> type) {
        return new Redis<>(this.redisTemplate, this.objectMapper, group, type);
    }

    /** "group:key" format me poori Redis key banata hai. */
    private String buildKey(String key) {
        if (group == null) {
            return key;
        }
        return group + ":" + key;
    }

    /**
     * Value ko JSON bana ke Redis me save karta hai (bina expiry ke).
     * Agar JSON banana fail ho jaaye to RuntimeException phenkta hai.
     */
    public void set(String key, T value) {
        try {
            String json = objectMapper.writeValueAsString(value);
            redisTemplate.opsForValue().set(buildKey(key), json);
        } catch (Exception e) {
            throw new RuntimeException("Redis serialization error", e);
        }
    }

    /**
     * Value ko JSON bana ke save karta hai, aur ttl ke baad Redis khud isko delete kar dega.
     * (TTL = time to live, yaani kitni der tak key zinda rahegi.)
     */
    public void set(String key, T value, Duration ttl) {
        try {
            String json = objectMapper.writeValueAsString(value);
            redisTemplate.opsForValue().set(buildKey(key), json, ttl);
        } catch (Exception e) {
            throw new RuntimeException("Redis serialization error", e);
        }
    }

    /**
     * Key ki value padhta hai.
     * Output: Optional.empty() agar key nahi mili, khaali hai, ya JSON padh nahi paaye.
     * (Kharab data pe crash karne ke bajaye "nahi mila" maan lete hain.)
     */
    public Optional<T> get(String key) {
        String json = redisTemplate.opsForValue().get(buildKey(key));
        if (json == null || json.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.of(objectMapper.readValue(json, type));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    /** Key delete karta hai. Output: true agar key sach me thi aur delete hui. */
    public boolean delete(String key) {
        return Boolean.TRUE.equals(redisTemplate.delete(buildKey(key)));
    }

    /** Key delete karta hai, result ki parwaah nahi (key na ho to bhi koi error nahi). */
    public void deleteIfExists(String key) {
        redisTemplate.delete(buildKey(key));
    }

    /** Check karta hai ki key Redis me hai ya nahi. */
    public boolean exists(String key) {
        return Boolean.TRUE.equals(redisTemplate.hasKey(buildKey(key)));
    }
}

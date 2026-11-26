package me.one_org.melody.Services.Authentication;

import java.time.Duration;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Exceptions.TooManyRequestsException;

/**
 * Redis wali rate limit (login, OTP jaise endpoints ke liye).
 *
 * Tareeka (fixed window counter): key ka count +1 (INCR). Pehli request pe key ki expiry = window.
 * Count max se zyada = 429. Window khatam -> key apne aap delete -> count dobara 0.
 * Redis down ho to request ko jaane dete hain (block karne se behtar hai).
 */
@Service
@Slf4j
public class RateLimiterService {

    private final StringRedisTemplate redisTemplate;

    public RateLimiterService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    /** Is key pe window me maxRequests se zyada hue to 429. */
    public void checkRateLimit(String key, int maxRequests, Duration window) {
        try {
            Long count = redisTemplate.opsForValue().increment(key);
            if (count != null && count == 1L) {
                redisTemplate.expire(key, window);
            }
            if (count != null && count > maxRequests) {
                log.warn("Rate limit exceeded for key [{}]: {}/{} in {}", key, count, maxRequests, window);
                throw new TooManyRequestsException("Too many requests. Please try again later.");
            }
        } catch (TooManyRequestsException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Redis rate limiter check failed for key [{}]: {}. Allowing request through.", key, e.getMessage());
        }
    }

    /** Cooldown chal raha hai to 429 ("X seconds wait karo"). */
    public void checkCooldown(String key) {
        try {
            Boolean hasCooldown = redisTemplate.hasKey(key);
            if (Boolean.TRUE.equals(hasCooldown)) {
                Long expire = redisTemplate.getExpire(key);
                long secondsLeft = expire != null && expire > 0 ? expire : 60;
                throw new TooManyRequestsException("Please wait " + secondsLeft + " seconds before requesting another code.");
            }
        } catch (TooManyRequestsException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Redis cooldown check failed for key [{}]: {}. Allowing request through.", key, e.getMessage());
        }
    }

    /** Cooldown shuru karo (jaise OTP resend ke baad 60 second). */
    public void setCooldown(String key, Duration duration) {
        try {
            redisTemplate.opsForValue().set(key, "1", duration);
        } catch (Exception e) {
            log.warn("Redis setCooldown failed for key [{}]: {}", key, e.getMessage());
        }
    }
}

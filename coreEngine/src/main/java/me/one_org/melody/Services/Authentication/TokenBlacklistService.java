package me.one_org.melody.Services.Authentication;

import java.time.Duration;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import lombok.extern.slf4j.Slf4j;

/**
 * Logout kiye access tokens ki blacklist (Redis key blacklist:token:<jti>).
 *
 * JWT khud expire hone tak valid rehta hai. Logout pe use turant band karne ke liye uski jti
 * Redis me utni der ke liye daal dete hain jitna token me time bacha hai. Har request pe SecurityConfig
 * yahan check karta hai. Redis down ho to "blacklisted nahi" maan lete hain.
 */
@Service
@Slf4j
public class TokenBlacklistService {

    private static final String PREFIX = "blacklist:token:";
    private final StringRedisTemplate redisTemplate;

    public TokenBlacklistService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    /** jti ko bache hue time (remainingTtl) ke liye blacklist me daalo. */
    public void blacklistToken(String jti, Duration remainingTtl) {
        if (jti == null || jti.isBlank()) {
            return;
        }
        if (remainingTtl == null || remainingTtl.isNegative() || remainingTtl.isZero()) {
            return;
        }
        try {
            redisTemplate.opsForValue().set(PREFIX + jti, "revoked", remainingTtl);
            log.info("Access token with jti [{}] blacklisted for {} seconds", jti, remainingTtl.getSeconds());
        } catch (Exception e) {
            log.warn("Failed to blacklist token [{}]: {}", jti, e.getMessage());
        }
    }

    /** Kya ye token logout ho chuka hai? */
    public boolean isBlacklisted(String jti) {
        if (jti == null || jti.isBlank()) {
            return false;
        }
        try {
            return Boolean.TRUE.equals(redisTemplate.hasKey(PREFIX + jti));
        } catch (Exception e) {
            log.warn("Failed to check token blacklist for [{}]: {}", jti, e.getMessage());
            return false;
        }
    }
}

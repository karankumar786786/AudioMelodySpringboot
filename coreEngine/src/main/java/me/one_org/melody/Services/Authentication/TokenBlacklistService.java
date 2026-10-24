package me.one_org.melody.Services.Authentication;

import java.time.Duration;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class TokenBlacklistService {

    private static final String PREFIX = "blacklist:token:";
    private final StringRedisTemplate redisTemplate;

    public TokenBlacklistService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

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

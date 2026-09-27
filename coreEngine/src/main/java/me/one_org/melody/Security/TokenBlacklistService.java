package me.one_org.melody.Security;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Utils.JwtUtil;

/**
 * Manages token revocation and instant session termination in Redis.
 * Supports individual JWT blacklisting (on logout) and user-level session invalidation (on block/ban).
 */
@Service
@Slf4j
public class TokenBlacklistService {

    private final StringRedisTemplate redisTemplate;
    private final JwtUtil jwtUtil;

    private static final String BLACKLIST_TOKEN_PREFIX = "token:blacklist:";
    private static final String USER_BLOCKED_PREFIX = "user:blocked:";

    public TokenBlacklistService(StringRedisTemplate redisTemplate, JwtUtil jwtUtil) {
        this.redisTemplate = redisTemplate;
        this.jwtUtil = jwtUtil;
    }

    /**
     * Blacklists an active JWT token until its natural expiration time.
     */
    public void blacklistToken(String token) {
        try {
            long remainingSeconds = jwtUtil.getRemainingSeconds(token);
            if (remainingSeconds > 0) {
                redisTemplate.opsForValue().set(
                        BLACKLIST_TOKEN_PREFIX + token,
                        "revoked",
                        remainingSeconds,
                        TimeUnit.SECONDS
                );
                log.info("Token successfully blacklisted in Redis for {} seconds", remainingSeconds);
            }
        } catch (Exception e) {
            log.warn("Failed to blacklist token in Redis: {}", e.getMessage());
        }
    }

    /**
     * Checks if a token has been revoked.
     */
    public boolean isTokenBlacklisted(String token) {
        if (token == null || token.isBlank()) return false;
        try {
            return Boolean.TRUE.equals(redisTemplate.hasKey(BLACKLIST_TOKEN_PREFIX + token));
        } catch (Exception e) {
            log.warn("Error querying token blacklist from Redis: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Marks a user as blocked across all active sessions for 7 days.
     */
    public void blockUser(String userId) {
        if (userId == null || userId.isBlank()) return;
        try {
            redisTemplate.opsForValue().set(
                    USER_BLOCKED_PREFIX + userId,
                    "blocked",
                    Duration.ofDays(7)
            );
            log.info("User [{}] marked blocked in Redis session cache", userId);
        } catch (Exception e) {
            log.warn("Failed to block user in Redis: {}", e.getMessage());
        }
    }

    /**
     * Unblocks a user in the Redis session cache.
     */
    public void unblockUser(String userId) {
        if (userId == null || userId.isBlank()) return;
        try {
            redisTemplate.delete(USER_BLOCKED_PREFIX + userId);
            log.info("User [{}] unblocked in Redis session cache", userId);
        } catch (Exception e) {
            log.warn("Failed to unblock user in Redis: {}", e.getMessage());
        }
    }

    /**
     * Checks if a user is currently blocked in the Redis cache.
     */
    public boolean isUserBlocked(String userId) {
        if (userId == null || userId.isBlank()) return false;
        try {
            return Boolean.TRUE.equals(redisTemplate.hasKey(USER_BLOCKED_PREFIX + userId));
        } catch (Exception e) {
            log.warn("Error querying user blocked status from Redis: {}", e.getMessage());
            return false;
        }
    }
}

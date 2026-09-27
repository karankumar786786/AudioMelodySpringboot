package me.one_org.melody.Filters;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Distributed rate limiter for authentication endpoints using Redis,
 * with local in-memory Bucket4j fallback if Redis is temporarily unreachable.
 * Limits each client IP to 10 requests per minute on /auth/** paths.
 */
@Component
@Slf4j
public class RateLimitFilter extends OncePerRequestFilter {

    private final StringRedisTemplate redisTemplate;
    private final Map<String, Bucket> localBuckets = new ConcurrentHashMap<>();

    private static final int MAX_REQUESTS_PER_MINUTE = 10;
    private static final String REDIS_RATE_LIMIT_PREFIX = "ratelimit:auth:";

    public RateLimitFilter(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    private Bucket createNewLocalBucket() {
        return Bucket.builder()
                .addLimit(Bandwidth.classic(MAX_REQUESTS_PER_MINUTE, Refill.greedy(MAX_REQUESTS_PER_MINUTE, Duration.ofMinutes(1))))
                .build();
    }

    private boolean isAllowed(String clientIp) {
        String key = REDIS_RATE_LIMIT_PREFIX + clientIp;
        try {
            Long count = redisTemplate.opsForValue().increment(key);
            if (count != null && count == 1) {
                redisTemplate.expire(key, Duration.ofMinutes(1));
            }
            return count != null && count <= MAX_REQUESTS_PER_MINUTE;
        } catch (Exception e) {
            log.warn("Redis rate limiter unavailable for IP {}, falling back to local bucket: {}", clientIp, e.getMessage());
            Bucket localBucket = localBuckets.computeIfAbsent(clientIp, k -> createNewLocalBucket());
            return localBucket.tryConsume(1);
        }
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String path = request.getRequestURI();

        // Only rate-limit auth endpoints
        if (!path.startsWith("/auth/")) {
            filterChain.doFilter(request, response);
            return;
        }

        String clientIp = getClientIp(request);

        if (isAllowed(clientIp)) {
            filterChain.doFilter(request, response);
        } else {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType("application/json");
            response.getWriter().write(
                    "{\"status\":429,\"error\":\"Too Many Requests\",\"message\":\"Rate limit exceeded. Please try again later.\",\"path\":\"" + path + "\"}"
            );
        }
    }

    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}

package me.one_org.melody.Services.Api;

import java.time.Duration;
import java.time.LocalDateTime;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Dto.Controllers.Api.UpdateProgressRequestDto;
import me.one_org.melody.Dto.Controllers.Api.UserProgressDto;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Repository.SongsRepository;

@Service
@Transactional(readOnly = true)
@Slf4j
public class UserProgressApiService {

    private static final String REDIS_PREFIX = "user:progress:";
    private static final Duration PROGRESS_TTL = Duration.ofDays(30);

    private final StringRedisTemplate redisTemplate;
    private final SongsRepository songsRepository;
    private final ObjectMapper objectMapper;

    public UserProgressApiService(
            StringRedisTemplate redisTemplate,
            SongsRepository songsRepository,
            ObjectMapper objectMapper
    ) {
        this.redisTemplate = redisTemplate;
        this.songsRepository = songsRepository;
        this.objectMapper = objectMapper != null ? objectMapper : new ObjectMapper();
    }

    public UserProgressDto saveProgress(String userId, UpdateProgressRequestDto request) {
        if (userId == null || userId.isBlank() || request == null) {
            return null;
        }

        String cacheKey = REDIS_PREFIX + userId.trim();
        double duration = request.duration() != null && request.duration() > 0 ? request.duration() : 0.0;
        double currentTime = Math.max(0.0, request.currentTime());
        double progressPercent = duration > 0 ? Math.min(100.0, (currentTime / duration) * 100.0) : 0.0;
        LocalDateTime now = LocalDateTime.now();

        try {
            if (redisTemplate != null) {
                ObjectNode node = objectMapper.createObjectNode();
                node.put("songId", request.songId());
                node.put("currentTime", currentTime);
                node.put("duration", duration);
                node.put("progressPercent", progressPercent);
                node.put("contextType", request.contextType() != null ? request.contextType() : "default");
                node.put("contextId", request.contextId() != null ? request.contextId() : "");
                node.put("updatedAt", now.toString());

                redisTemplate.opsForValue().set(cacheKey, objectMapper.writeValueAsString(node), PROGRESS_TTL);
            }
        } catch (Exception e) {
            log.warn("Failed to persist user progress to Redis for user [{}]: {}", userId, e.getMessage());
        }

        return new UserProgressDto(
                request.songId(),
                currentTime,
                duration,
                progressPercent,
                request.contextType(),
                request.contextId(),
                now,
                null
        );
    }

    public UserProgressDto getProgress(String userId) {
        if (userId == null || userId.isBlank() || redisTemplate == null) {
            return null;
        }

        String cacheKey = REDIS_PREFIX + userId.trim();
        try {
            String json = redisTemplate.opsForValue().get(cacheKey);
            if (json == null || json.isBlank()) {
                return null;
            }

            JsonNode node = objectMapper.readTree(json);
            String songId = node.hasNonNull("songId") ? node.get("songId").asText() : null;
            if (songId == null || songId.isBlank()) {
                return null;
            }

            double currentTime = node.hasNonNull("currentTime") ? node.get("currentTime").asDouble() : 0.0;
            double duration = node.hasNonNull("duration") ? node.get("duration").asDouble() : 0.0;
            double progressPercent = node.hasNonNull("progressPercent") ? node.get("progressPercent").asDouble() : 0.0;
            String contextType = node.hasNonNull("contextType") ? node.get("contextType").asText() : null;
            String contextId = node.hasNonNull("contextId") ? node.get("contextId").asText() : null;
            LocalDateTime updatedAt = node.hasNonNull("updatedAt")
                    ? LocalDateTime.parse(node.get("updatedAt").asText())
                    : LocalDateTime.now();

            SongDto songDto = songsRepository.findById(songId)
                    .map(SongDto::fromEntity)
                    .orElse(null);

            return new UserProgressDto(
                    songId,
                    currentTime,
                    duration,
                    progressPercent,
                    contextType,
                    contextId,
                    updatedAt,
                    songDto
            );
        } catch (Exception e) {
            log.warn("Failed to read user progress from Redis for user [{}]: {}", userId, e.getMessage());
            return null;
        }
    }

    public void clearProgress(String userId) {
        if (userId == null || userId.isBlank() || redisTemplate == null) {
            return;
        }
        try {
            redisTemplate.delete(REDIS_PREFIX + userId.trim());
        } catch (Exception e) {
            log.warn("Failed to clear user progress in Redis for user [{}]: {}", userId, e.getMessage());
        }
    }
}

package me.one_org.melody.Services.Authentication;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Dto.Controllers.User.UserSessionDto;
import me.one_org.melody.Exceptions.BadRequestException;
import me.one_org.melody.Repository.SessionRepository;

@Service
@Slf4j
public class UserSessionService {

    private final SessionRepository sessionRepository;

    public UserSessionService(SessionRepository sessionRepository) {
        this.sessionRepository = sessionRepository;
    }

    @Transactional(readOnly = true)
    public List<UserSessionDto> getUserSessions(String userId, String currentDeviceId) {
        if (userId == null || userId.isBlank()) {
            throw new BadRequestException("User ID is required");
        }
        if (currentDeviceId == null || currentDeviceId.isBlank()) {
            throw new BadRequestException("Device ID is required");
        }
        return sessionRepository.findByUserIdOrderByUpdatedAtDesc(userId).stream()
                .map(s -> new UserSessionDto(
                        s.getId(),
                        s.getDeviceId(),
                        s.getDeviceName() != null ? s.getDeviceName() : "Unknown Device",
                        s.getIpAddress() != null ? s.getIpAddress() : "Unknown IP",
                        s.getLocation() != null ? s.getLocation() : "Unknown Location",
                        s.getLastActiveAt() != null ? s.getLastActiveAt() : s.getUpdatedAt(),
                        s.getExpiresAt(),
                        s.getCreatedAt(),
                        s.getUpdatedAt(),
                        currentDeviceId.equals(s.getDeviceId())
                ))
                .toList();
    }

    @Transactional
    public void revokeSession(String userId, String sessionId) {
        if (userId == null || userId.isBlank()) {
            throw new BadRequestException("User ID is required");
        }
        if (sessionId == null || sessionId.isBlank()) {
            throw new BadRequestException("Session ID is required");
        }
        int deleted = sessionRepository.deleteByUserIdAndSessionId(userId, sessionId);
        log.info("Revoked user session [{}] for user [{}], deleted count: {}", sessionId, userId, deleted);
    }

    @Transactional
    public void revokeOtherSessions(String userId, String currentDeviceId) {
        if (userId == null || userId.isBlank()) {
            throw new BadRequestException("User ID is required");
        }
        if (currentDeviceId == null || currentDeviceId.isBlank()) {
            throw new BadRequestException("Device ID is required");
        }
        int deleted = sessionRepository.deleteByUserIdAndDeviceIdNot(userId, currentDeviceId);
        log.info("Revoked {} other session(s) for user [{}] keeping device [{}]", deleted, userId, currentDeviceId);
    }
}

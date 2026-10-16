package me.one_org.melody.Services.Authentication;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Dto.Controllers.User.UserSessionDto;
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
            return List.of();
        }
        return sessionRepository.findByUserIdOrderByUpdatedAtDesc(userId).stream()
                .map(s -> new UserSessionDto(
                        s.getId(),
                        s.getDeviceId(),
                        s.getExpiresAt(),
                        s.getCreatedAt(),
                        s.getUpdatedAt(),
                        currentDeviceId != null && currentDeviceId.equals(s.getDeviceId())
                ))
                .toList();
    }

    @Transactional
    public void revokeSession(String userId, String sessionId) {
        if (userId == null || sessionId == null) return;
        int deleted = sessionRepository.deleteByUserIdAndSessionId(userId, sessionId);
        log.info("Revoked user session [{}] for user [{}], deleted count: {}", sessionId, userId, deleted);
    }

    @Transactional
    public void revokeOtherSessions(String userId, String currentDeviceId) {
        if (userId == null || currentDeviceId == null || currentDeviceId.isBlank()) return;
        int deleted = sessionRepository.deleteByUserIdAndDeviceIdNot(userId, currentDeviceId);
        log.info("Revoked {} other session(s) for user [{}] keeping device [{}]", deleted, userId, currentDeviceId);
    }
}

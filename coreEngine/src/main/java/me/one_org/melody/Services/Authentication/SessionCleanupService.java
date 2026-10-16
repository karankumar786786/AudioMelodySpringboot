package me.one_org.melody.Services.Authentication;

import java.time.LocalDateTime;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import me.one_org.melody.Repository.SessionRepository;

@Service
public class SessionCleanupService {

    private final SessionRepository sessionRepository;

    public SessionCleanupService(SessionRepository sessionRepository) {
        this.sessionRepository = sessionRepository;
    }

    /**
     * Purges expired sessions daily at 3:00 AM server time.
     * Can also be triggered programmatically.
     *
     * @return count of purged sessions
     */
    @Scheduled(cron = "${melody.session.cleanup.cron:0 0 3 * * *}")
    @Transactional
    public int purgeExpiredSessions() {
        return sessionRepository.deleteExpiredSessions(LocalDateTime.now());
    }
}

package me.one_org.melody.Services.Authentication;

import java.time.LocalDateTime;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import me.one_org.melody.Repository.SessionRepository;

/**
 * Purane (expire ho chuke) login sessions ki safai - roz ek baar chalta hai (@Scheduled).
 */
@Service
public class SessionCleanupService {

    private final SessionRepository sessionRepository;

    public SessionCleanupService(SessionRepository sessionRepository) {
        this.sessionRepository = sessionRepository;
    }

    /**
     * Har raat 3 baje (server time) expire hue sessions database se hatata hai.
     * Code se bhi seedha call kar sakte hain.
     *
     * @return kitne sessions hataye
     */
    @Scheduled(cron = "${melody.session.cleanup.cron:0 0 3 * * *}")
    @Transactional
    public int purgeExpiredSessions() {
        return sessionRepository.deleteExpiredSessions(LocalDateTime.now());
    }
}

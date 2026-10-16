package me.one_org.melody.Services.Authentication;

import java.time.LocalDateTime;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import me.one_org.melody.Repository.SessionRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SessionCleanupServiceTest {

    @Mock
    private SessionRepository sessionRepository;

    @InjectMocks
    private SessionCleanupService sessionCleanupService;

    @Test
    @DisplayName("Should purge expired sessions and return deleted count")
    void shouldPurgeExpiredSessions() {
        when(sessionRepository.deleteExpiredSessions(any(LocalDateTime.class))).thenReturn(5);

        int deletedCount = sessionCleanupService.purgeExpiredSessions();

        assertThat(deletedCount).isEqualTo(5);
        verify(sessionRepository).deleteExpiredSessions(any(LocalDateTime.class));
    }
}

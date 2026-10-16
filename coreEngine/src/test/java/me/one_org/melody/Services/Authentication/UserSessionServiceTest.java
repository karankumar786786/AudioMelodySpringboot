package me.one_org.melody.Services.Authentication;

import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import me.one_org.melody.Dto.Controllers.User.UserSessionDto;
import me.one_org.melody.Entity.Session;
import me.one_org.melody.Repository.SessionRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserSessionServiceTest {

    @Mock
    private SessionRepository sessionRepository;

    @InjectMocks
    private UserSessionService userSessionService;

    @Test
    @DisplayName("Should retrieve user sessions and mark current device")
    void shouldGetUserSessions() {
        Session s1 = new Session();
        s1.setId("sess-1");
        s1.setDeviceId("device-phone");
        s1.setExpiresAt(LocalDateTime.now().plusDays(5));
        s1.setCreatedAt(LocalDateTime.now().minusDays(2));
        s1.setUpdatedAt(LocalDateTime.now().minusDays(1));

        Session s2 = new Session();
        s2.setId("sess-2");
        s2.setDeviceId("device-laptop");
        s2.setExpiresAt(LocalDateTime.now().plusDays(5));
        s2.setCreatedAt(LocalDateTime.now().minusDays(1));
        s2.setUpdatedAt(LocalDateTime.now());

        when(sessionRepository.findByUserIdOrderByUpdatedAtDesc("user-1")).thenReturn(List.of(s2, s1));

        List<UserSessionDto> result = userSessionService.getUserSessions("user-1", "device-phone");

        assertThat(result).hasSize(2);
        assertThat(result.get(0).deviceId()).isEqualTo("device-laptop");
        assertThat(result.get(0).isCurrent()).isFalse();
        assertThat(result.get(1).deviceId()).isEqualTo("device-phone");
        assertThat(result.get(1).isCurrent()).isTrue();
    }

    @Test
    @DisplayName("Should revoke specific session")
    void shouldRevokeSpecificSession() {
        userSessionService.revokeSession("user-1", "sess-1");
        verify(sessionRepository).deleteByUserIdAndSessionId("user-1", "sess-1");
    }

    @Test
    @DisplayName("Should revoke other sessions")
    void shouldRevokeOtherSessions() {
        userSessionService.revokeOtherSessions("user-1", "device-phone");
        verify(sessionRepository).deleteByUserIdAndDeviceIdNot("user-1", "device-phone");
    }
}

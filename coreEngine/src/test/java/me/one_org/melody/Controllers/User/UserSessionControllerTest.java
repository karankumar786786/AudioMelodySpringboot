package me.one_org.melody.Controllers.User;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import me.one_org.melody.Dto.Controllers.User.UserSessionDto;
import me.one_org.melody.Enums.RoleEnum;
import me.one_org.melody.Enums.StatusEnum;
import me.one_org.melody.Security.CustomUserDetails;
import me.one_org.melody.Services.Authentication.UserSessionService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserSessionControllerTest {

    @Mock
    private UserSessionService userSessionService;

    @InjectMocks
    private UserSessionController userSessionController;

    private final CustomUserDetails currentUser = new CustomUserDetails(
            "user-1",
            "user@melody.com",
            "karan",
            RoleEnum.USER,
            StatusEnum.ACTIVE
    );

    @Test
    @DisplayName("Should return user sessions and identify current device")
    void shouldReturnUserSessions() {
        UserSessionDto session = new UserSessionDto(
                "sess-1",
                "device-mac-1",
                LocalDateTime.now().plusDays(7),
                LocalDateTime.now().minusDays(1),
                LocalDateTime.now(),
                true
        );
        when(userSessionService.getUserSessions("user-1", "device-mac-1"))
                .thenReturn(List.of(session));

        ResponseEntity<List<UserSessionDto>> response = userSessionController.getSessions(currentUser, "device-mac-1");

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).hasSize(1);
        assertThat(response.getBody().get(0).isCurrent()).isTrue();
        assertThat(response.getBody().get(0).deviceId()).isEqualTo("device-mac-1");
    }

    @Test
    @DisplayName("Should revoke specific session")
    void shouldRevokeSpecificSession() {
        ResponseEntity<Void> response = userSessionController.revokeSession(currentUser, "sess-1");

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        verify(userSessionService).revokeSession("user-1", "sess-1");
    }

    @Test
    @DisplayName("Should revoke other sessions keeping current device")
    void shouldRevokeOtherSessions() {
        ResponseEntity<Map<String, String>> response = userSessionController.revokeOtherSessions(currentUser, new me.one_org.melody.Dto.Controllers.User.RevokeOthersRequestDto("device-mac-1"));

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).containsKey("message");
        verify(userSessionService).revokeOtherSessions("user-1", "device-mac-1");
    }
}

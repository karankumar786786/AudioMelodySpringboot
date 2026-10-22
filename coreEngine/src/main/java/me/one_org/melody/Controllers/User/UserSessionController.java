package me.one_org.melody.Controllers.User;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import me.one_org.melody.Dto.Controllers.User.UserSessionDto;
import me.one_org.melody.Security.CurrentUser;
import me.one_org.melody.Security.CustomUserDetails;
import me.one_org.melody.Services.Authentication.UserSessionService;

@RestController
@RequestMapping("/api/user/sessions")
public class UserSessionController {

    private final UserSessionService userSessionService;

    public UserSessionController(UserSessionService userSessionService) {
        this.userSessionService = userSessionService;
    }

    @GetMapping
    public ResponseEntity<List<UserSessionDto>> getSessions(
            @CurrentUser CustomUserDetails currentUser,
            @RequestHeader(value = "X-Device-Id", required = false) String currentDeviceId) {
        List<UserSessionDto> sessions = userSessionService.getUserSessions(currentUser.getId(), currentDeviceId);
        return ResponseEntity.ok(sessions);
    }

    @DeleteMapping("/{sessionId}")
    public ResponseEntity<Void> revokeSession(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable String sessionId) {
        userSessionService.revokeSession(currentUser.getId(), sessionId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/revoke-others")
    public ResponseEntity<Map<String, String>> revokeOtherSessions(
            @CurrentUser CustomUserDetails currentUser,
            @RequestHeader(value = "X-Device-Id", required = false) String currentDeviceId) {
        userSessionService.revokeOtherSessions(currentUser.getId(), currentDeviceId);
        return ResponseEntity.ok(Map.of("message", "Other device sessions revoked successfully"));
    }
}

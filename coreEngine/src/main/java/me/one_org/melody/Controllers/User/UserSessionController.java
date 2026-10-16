package me.one_org.melody.Controllers.User;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import me.one_org.melody.Dto.Controllers.User.UserSessionDto;
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
            @RequestAttribute("userId") String userId,
            @RequestHeader(value = "X-Device-Id", required = false) String currentDeviceId) {
        List<UserSessionDto> sessions = userSessionService.getUserSessions(userId, currentDeviceId);
        return ResponseEntity.ok(sessions);
    }

    @DeleteMapping("/{sessionId}")
    public ResponseEntity<Void> revokeSession(
            @RequestAttribute("userId") String userId,
            @PathVariable String sessionId) {
        userSessionService.revokeSession(userId, sessionId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/revoke-others")
    public ResponseEntity<Map<String, String>> revokeOtherSessions(
            @RequestAttribute("userId") String userId,
            @RequestHeader(value = "X-Device-Id", required = false) String currentDeviceId) {
        userSessionService.revokeOtherSessions(userId, currentDeviceId);
        return ResponseEntity.ok(Map.of("message", "Other device sessions revoked successfully"));
    }
}

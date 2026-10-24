package me.one_org.melody.Controllers.User;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import me.one_org.melody.Dto.Controllers.User.RevokeOthersRequestDto;
import me.one_org.melody.Dto.Controllers.User.UserSessionDto;
import me.one_org.melody.Security.CurrentUser;
import me.one_org.melody.Security.CustomUserDetails;
import me.one_org.melody.Services.Authentication.UserSessionService;

@RestController
@RequestMapping("/api/user/sessions")
@Validated
public class UserSessionController {

    private final UserSessionService userSessionService;

    public UserSessionController(UserSessionService userSessionService) {
        this.userSessionService = userSessionService;
    }

    @GetMapping
    public ResponseEntity<List<UserSessionDto>> getSessions(
            @CurrentUser CustomUserDetails currentUser,
            @RequestParam(value = "deviceId") @NotBlank(message = "Device ID is required") String deviceId) {
        List<UserSessionDto> sessions = userSessionService.getUserSessions(currentUser.getId(), deviceId);
        return ResponseEntity.ok(sessions);
    }

    @DeleteMapping("/{sessionId}")
    public ResponseEntity<Void> revokeSession(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Session ID is required") String sessionId) {
        userSessionService.revokeSession(currentUser.getId(), sessionId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/revoke-others")
    public ResponseEntity<Map<String, String>> revokeOtherSessions(
            @CurrentUser CustomUserDetails currentUser,
            @Valid @RequestBody RevokeOthersRequestDto request) {
        userSessionService.revokeOtherSessions(currentUser.getId(), request.deviceId());
        return ResponseEntity.ok(Map.of("message", "Other device sessions revoked successfully"));
    }
}

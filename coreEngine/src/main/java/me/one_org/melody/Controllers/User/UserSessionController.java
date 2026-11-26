package me.one_org.melody.Controllers.User;

import java.util.List;

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
import me.one_org.melody.Dto.Controllers.Authentication.LogoutRequestDto;
import me.one_org.melody.Dto.Controllers.Authentication.SessionStatusDto;
import me.one_org.melody.Dto.Controllers.User.RevokeOthersRequestDto;
import me.one_org.melody.Dto.Controllers.User.UserSessionDto;
import me.one_org.melody.Security.CurrentUser;
import me.one_org.melody.Security.CustomUserDetails;
import me.one_org.melody.Services.Authentication.UserSessionService;

/**
 * Login sessions ki API: kaunse devices pe login hai, kisi device ko logout karna.
 *
 * Controller = HTTP request ka pehla stop. Ye sirf request padhta hai, service ko kaam deta hai,
 * aur response (JSON) lautata hai. Asli logic service me hai.
 */
@RestController
@RequestMapping("/api/user/sessions")
@Validated
public class UserSessionController {

    private final UserSessionService userSessionService;

    public UserSessionController(UserSessionService userSessionService) {
        this.userSessionService = userSessionService;
    }

    /** GET /api/user/sessions/status - website ke liye: logged-in hai ya nahi (token na ho to bhi 200). */
    @GetMapping({"/session", "/status"})
    public ResponseEntity<SessionStatusDto> getSession(@CurrentUser CustomUserDetails currentUser) {
        return ResponseEntity.ok(SessionStatusDto.authenticated(
                currentUser.getId(),
                currentUser.getEmail(),
                currentUser.getUserName()
        ));
    }

    /** GET /api/user/sessions - user ke saare login sessions (kaunsa current hai, bhi batata hai). */
    @GetMapping
    public ResponseEntity<List<UserSessionDto>> getSessions(
            @CurrentUser CustomUserDetails currentUser,
            @RequestParam @NotBlank(message = "Device ID is required") String deviceId) {
        List<UserSessionDto> sessions = userSessionService.getUserSessions(currentUser.getId(), deviceId);
        return ResponseEntity.ok(sessions);
    }

    /** DELETE /api/user/sessions/{sessionId} - us device ko logout karo. */
    @DeleteMapping("/{sessionId}")
    public ResponseEntity<Void> revokeSession(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Session ID is required") String sessionId) {
        userSessionService.revokeSession(currentUser.getId(), sessionId);
        return ResponseEntity.noContent().build();
    }

    /** POST /api/user/sessions/revoke-others - is device ko chhod ke sab jagah se logout. */
    @PostMapping("/revoke-others")
    public ResponseEntity<Void> revokeOtherSessions(
            @CurrentUser CustomUserDetails currentUser,
            @Valid @RequestBody RevokeOthersRequestDto request) {
        userSessionService.revokeOtherSessions(currentUser.getId(), request.deviceId());
        return ResponseEntity.noContent().build();
    }

    /** POST /api/user/sessions/logout - is device se (ya saare devices se) logout. */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @CurrentUser CustomUserDetails currentUser,
            @Valid @RequestBody LogoutRequestDto request) {
        userSessionService.logout(currentUser.getId(), request.deviceId(), request.isAllDevices());
        return ResponseEntity.noContent().build();
    }
}

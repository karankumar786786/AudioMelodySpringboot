package me.one_org.melody.Controllers.Authentication;


import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import me.one_org.melody.Dto.Controllers.Authentication.LoginRequestDto;
import me.one_org.melody.Dto.Controllers.Authentication.RefreshTokenRequestDto;
import me.one_org.melody.Dto.Controllers.Authentication.RefreshTokenResponseDto;
import me.one_org.melody.Dto.Controllers.Authentication.RegisterAndLoginResponse;
import me.one_org.melody.Dto.Controllers.Authentication.RegisterRequestDto;
import me.one_org.melody.Dto.Controllers.Authentication.VerifyOtpRequest;
import me.one_org.melody.Dto.Controllers.Authentication.VerifyOtpResponse;
import me.one_org.melody.Exceptions.UnauthorizedException;
import me.one_org.melody.Services.Authentication.AuthenticationService;
import me.one_org.melody.Utils.CookieUtil;

@RestController
@RequestMapping("/auth")
public class AuthenticationController {

    private final AuthenticationService authenticationService;
    private final CookieUtil cookieUtil;

    public AuthenticationController(AuthenticationService authenticationService, CookieUtil cookieUtil) {
        this.authenticationService = authenticationService;
        this.cookieUtil = cookieUtil;
    }

    @PostMapping("/register")
    public ResponseEntity<RegisterAndLoginResponse> register(@Valid @RequestBody RegisterRequestDto request) {
        String tempToken = authenticationService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(new RegisterAndLoginResponse(tempToken));
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<VerifyOtpResponse> verifyOtp(
            @RequestHeader("X-TEMP-TOKEN") String tempToken,
            @RequestHeader(value = "X-Device-Id", required = false) String deviceIdHeader,
            @RequestHeader(value = "Accept-Cookies", required = false) String acceptCookies,
            @RequestHeader(value = "X-Accept-Cookies", required = false) String xAcceptCookies,
            @Valid @RequestBody VerifyOtpRequest verifyRequest,
            HttpServletResponse httpServletResponse
    ) {
        String effectiveDeviceId = (verifyRequest.deviceId() != null && !verifyRequest.deviceId().isBlank())
                ? verifyRequest.deviceId()
                : (deviceIdHeader != null && !deviceIdHeader.isBlank() ? deviceIdHeader : "default-device");
        VerifyOtpResponse response = authenticationService.verifyOtp(tempToken, verifyRequest.otp(), effectiveDeviceId);

        if (wantsCookies(acceptCookies, xAcceptCookies) && response.accessToken() != null) {
            cookieUtil.setAuthCookies(httpServletResponse, response.accessToken(), response.refreshToken());
        }

        return ResponseEntity.status(HttpStatus.OK).body(response);
    }

    @PostMapping("/resend-otp")
    public ResponseEntity<RegisterAndLoginResponse> resendOtp(
        @RequestHeader("X-TEMP-TOKEN") String tempToken
    ) {
        String token = authenticationService.resendOtp(tempToken);
        return ResponseEntity.status(HttpStatus.OK).body(new RegisterAndLoginResponse(token));
    }

    @PostMapping("/login")
    public ResponseEntity<RegisterAndLoginResponse> login(@Valid @RequestBody LoginRequestDto request) {
        String tempToken = authenticationService.login(request);
        return ResponseEntity.status(HttpStatus.OK).body(new RegisterAndLoginResponse(tempToken));
    }

    @PostMapping("/refresh-token")
    public ResponseEntity<RefreshTokenResponseDto> refreshToken(
            @RequestHeader(value = "X-Device-Id", required = false) String deviceIdHeader,
            @RequestHeader(value = "Accept-Cookies", required = false) String acceptCookies,
            @RequestHeader(value = "X-Accept-Cookies", required = false) String xAcceptCookies,
            @RequestBody(required = false) RefreshTokenRequestDto request,
            jakarta.servlet.http.HttpServletRequest httpRequest,
            HttpServletResponse httpServletResponse
    ) {
        String effectiveRefreshToken = (request != null && request.refreshToken() != null && !request.refreshToken().isBlank())
                ? request.refreshToken()
                : null;
        if (effectiveRefreshToken == null && httpRequest.getCookies() != null) {
            for (jakarta.servlet.http.Cookie c : httpRequest.getCookies()) {
                if ("system_refresh_token".equals(c.getName()) && c.getValue() != null && !c.getValue().isBlank()) {
                    effectiveRefreshToken = c.getValue();
                    break;
                }
            }
        }
        if (effectiveRefreshToken == null || effectiveRefreshToken.isBlank()) {
            throw new UnauthorizedException("No refresh token provided");
        }

        String effectiveDeviceId = (request != null && request.deviceId() != null && !request.deviceId().isBlank())
                ? request.deviceId()
                : (deviceIdHeader != null && !deviceIdHeader.isBlank() ? deviceIdHeader : null);
        RefreshTokenResponseDto response = authenticationService.refreshToken(effectiveRefreshToken, effectiveDeviceId);

        if (wantsCookies(acceptCookies, xAcceptCookies) && response.accessToken() != null) {
            cookieUtil.setAuthCookies(httpServletResponse, response.accessToken(), response.refreshToken());
        }

        return ResponseEntity.status(HttpStatus.OK).body(response);
    }

    @PostMapping("/logout")
    public ResponseEntity<java.util.Map<String, String>> logout(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-Device-Id", required = false) String deviceIdHeader,
            @RequestHeader(value = "Accept-Cookies", required = false) String acceptCookies,
            @RequestHeader(value = "X-Accept-Cookies", required = false) String xAcceptCookies,
            @RequestBody(required = false) RefreshTokenRequestDto request,
            jakarta.servlet.http.HttpServletRequest httpRequest,
            HttpServletResponse httpServletResponse) {
        String token = (authHeader != null && authHeader.startsWith("Bearer ")) ? authHeader.substring(7) : null;
        if (token == null && httpRequest.getCookies() != null) {
            for (jakarta.servlet.http.Cookie c : httpRequest.getCookies()) {
                if ("system_token".equals(c.getName()) && c.getValue() != null && !c.getValue().isBlank()) {
                    token = c.getValue();
                    break;
                }
            }
        }
        String refreshToken = request != null ? request.refreshToken() : null;
        if (refreshToken == null && httpRequest.getCookies() != null) {
            for (jakarta.servlet.http.Cookie c : httpRequest.getCookies()) {
                if ("system_refresh_token".equals(c.getName()) && c.getValue() != null && !c.getValue().isBlank()) {
                    refreshToken = c.getValue();
                    break;
                }
            }
        }
        String effectiveDeviceId = (request != null && request.deviceId() != null && !request.deviceId().isBlank())
                ? request.deviceId()
                : deviceIdHeader;
        authenticationService.logout(token, refreshToken, effectiveDeviceId);

        if (wantsCookies(acceptCookies, xAcceptCookies)) {
            cookieUtil.clearAuthCookies(httpServletResponse);
        }

        return ResponseEntity.ok(java.util.Map.of("message", "Logged out successfully"));
    }

    private boolean wantsCookies(String acceptCookies, String xAcceptCookies) {
        return "true".equalsIgnoreCase(acceptCookies) || "true".equalsIgnoreCase(xAcceptCookies);
    }
}

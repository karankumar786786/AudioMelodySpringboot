package me.one_org.melody.Controllers.Authentication;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import me.one_org.melody.Dto.Controllers.Authentication.LoginRequestDto;
import me.one_org.melody.Dto.Controllers.Authentication.RefreshTokenRequestDto;
import me.one_org.melody.Dto.Controllers.Authentication.RefreshTokenResponseDto;
import me.one_org.melody.Dto.Controllers.Authentication.RegisterAndLoginResponse;
import me.one_org.melody.Dto.Controllers.Authentication.RegisterRequestDto;
import me.one_org.melody.Dto.Controllers.Authentication.ResendOtpRequestDto;
import me.one_org.melody.Dto.Controllers.Authentication.VerifyOtpRequest;
import me.one_org.melody.Dto.Controllers.Authentication.VerifyOtpResponse;
import me.one_org.melody.Exceptions.UnauthorizedException;
import me.one_org.melody.Services.Authentication.AuthenticationService;
import me.one_org.melody.Utils.ClientDetector;
import me.one_org.melody.Utils.CookieUtil;

@RestController
@RequestMapping("/auth")
public class AuthenticationController {

    private final AuthenticationService authenticationService;
    private final CookieUtil cookieUtil;
    private final ClientDetector clientDetector;

    public AuthenticationController(
            AuthenticationService authenticationService,
            CookieUtil cookieUtil,
            ClientDetector clientDetector) {
        this.authenticationService = authenticationService;
        this.cookieUtil = cookieUtil;
        this.clientDetector = clientDetector;
    }

    @PostMapping("/register")
    public ResponseEntity<RegisterAndLoginResponse> register(@Valid @RequestBody RegisterRequestDto request) {
        String tempToken = authenticationService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(new RegisterAndLoginResponse(tempToken));
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<VerifyOtpResponse> verifyOtp(
            @Valid @RequestBody VerifyOtpRequest verifyRequest,
            HttpServletRequest httpRequest,
            HttpServletResponse httpServletResponse
    ) {
        VerifyOtpResponse response = authenticationService.verifyOtp(
                verifyRequest.tempToken(),
                verifyRequest.otp(),
                verifyRequest.deviceId()
        );

        if (clientDetector.isBrowser(httpRequest) && response.accessToken() != null) {
            cookieUtil.setAuthCookies(httpServletResponse, response.accessToken(), response.refreshToken());
        }

        return ResponseEntity.status(HttpStatus.OK).body(response);
    }

    @PostMapping("/resend-otp")
    public ResponseEntity<RegisterAndLoginResponse> resendOtp(
            @Valid @RequestBody ResendOtpRequestDto request
    ) {
        String token = authenticationService.resendOtp(request.tempToken());
        return ResponseEntity.status(HttpStatus.OK).body(new RegisterAndLoginResponse(token));
    }

    @PostMapping("/login")
    public ResponseEntity<RegisterAndLoginResponse> login(@Valid @RequestBody LoginRequestDto request) {
        String tempToken = authenticationService.login(request);
        return ResponseEntity.status(HttpStatus.OK).body(new RegisterAndLoginResponse(tempToken));
    }

    @PostMapping("/refresh-token")
    public ResponseEntity<RefreshTokenResponseDto> refreshToken(
            @Valid @RequestBody RefreshTokenRequestDto request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpServletResponse
    ) {
        String effectiveRefreshToken = (request.refreshToken() != null && !request.refreshToken().isBlank())
                ? request.refreshToken()
                : cookieUtil.getCookieValue(httpRequest, "system_refresh_token").orElse(null);

        if (effectiveRefreshToken == null || effectiveRefreshToken.isBlank()) {
            throw new UnauthorizedException("No refresh token provided");
        }

        RefreshTokenResponseDto response = authenticationService.refreshToken(effectiveRefreshToken, request.deviceId());

        if (clientDetector.isBrowser(httpRequest) && response.accessToken() != null) {
            cookieUtil.setAuthCookies(httpServletResponse, response.accessToken(), response.refreshToken());
        }

        return ResponseEntity.status(HttpStatus.OK).body(response);
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @Valid @RequestBody RefreshTokenRequestDto request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpServletResponse) {
        String token = (authHeader != null && authHeader.startsWith("Bearer "))
                ? authHeader.substring(7)
                : cookieUtil.getCookieValue(httpRequest, "system_token").orElse(null);

        String refreshToken = (request.refreshToken() != null && !request.refreshToken().isBlank())
                ? request.refreshToken()
                : cookieUtil.getCookieValue(httpRequest, "system_refresh_token").orElse(null);

        authenticationService.logout(token, refreshToken, request.deviceId());

        if (clientDetector.isBrowser(httpRequest)) {
            cookieUtil.clearAuthCookies(httpServletResponse);
        }

        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }
}

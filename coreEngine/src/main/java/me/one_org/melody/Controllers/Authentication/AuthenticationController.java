package me.one_org.melody.Controllers.Authentication;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import me.one_org.melody.Dto.Controllers.Authentication.AuthTempTokenResponse;
import me.one_org.melody.Dto.Controllers.Authentication.LoginRequestDto;
import me.one_org.melody.Dto.Controllers.Authentication.RefreshTokenRequestDto;
import me.one_org.melody.Dto.Controllers.Authentication.RefreshTokenResponseDto;
import me.one_org.melody.Dto.Controllers.Authentication.RegisterRequestDto;
import me.one_org.melody.Dto.Controllers.Authentication.ResendOtpRequestDto;
import me.one_org.melody.Dto.Controllers.Authentication.VerifyOtpRequest;
import me.one_org.melody.Dto.Controllers.Authentication.VerifyOtpResponse;
import me.one_org.melody.Dto.Controllers.Authentication.WebLogoutRequestDto;
import me.one_org.melody.Dto.Internal.ClientInfo;
import me.one_org.melody.Security.AuthCookies;
import me.one_org.melody.Services.Authentication.AuthenticationService;

@RestController
@RequestMapping("/auth")
public class AuthenticationController {

    private final AuthenticationService authenticationService;
    private final AuthCookies authCookies;

    public AuthenticationController(AuthenticationService authenticationService, AuthCookies authCookies) {
        this.authenticationService = authenticationService;
        this.authCookies = authCookies;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthTempTokenResponse> register(
            @Valid @RequestBody RegisterRequestDto request,
            ClientInfo clientInfo) {
        String clientIp = clientInfo != null ? clientInfo.ipAddress() : null;
        String tempToken = authenticationService.register(request, clientIp);
        return ResponseEntity.status(HttpStatus.CREATED).body(new AuthTempTokenResponse(tempToken));
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<VerifyOtpResponse> verifyOtp(
            @Valid @RequestBody VerifyOtpRequest verifyRequest,
            ClientInfo clientInfo,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        String clientIp = clientInfo != null ? clientInfo.ipAddress() : null;
        String deviceName = clientInfo != null ? clientInfo.deviceName() : "Web Browser";
        String location = clientInfo != null ? clientInfo.location() : "Unknown Location";

        VerifyOtpResponse response = authenticationService.verifyOtp(
                verifyRequest.tempToken(),
                verifyRequest.otp(),
                verifyRequest.deviceId(),
                deviceName,
                clientIp,
                location
        );
        if (AuthCookies.isWebClient(httpRequest)) {
            // Web: tokens live only in HttpOnly cookies, never in script-readable JSON.
            authCookies.writeTokens(httpResponse, response.accessToken(), response.refreshToken());
            return ResponseEntity.ok(new VerifyOtpResponse(null, null, response.isNewUser()));
        }
        return ResponseEntity.status(HttpStatus.OK).body(response);
    }

    @PostMapping("/resend-otp")
    public ResponseEntity<AuthTempTokenResponse> resendOtp(
            @Valid @RequestBody ResendOtpRequestDto request,
            ClientInfo clientInfo) {
        String clientIp = clientInfo != null ? clientInfo.ipAddress() : null;
        String token = authenticationService.resendOtp(request.tempToken(), clientIp);
        return ResponseEntity.status(HttpStatus.OK).body(new AuthTempTokenResponse(token));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthTempTokenResponse> login(
            @Valid @RequestBody LoginRequestDto request,
            ClientInfo clientInfo) {
        String clientIp = clientInfo != null ? clientInfo.ipAddress() : null;
        String tempToken = authenticationService.login(request, clientIp);
        return ResponseEntity.status(HttpStatus.OK).body(new AuthTempTokenResponse(tempToken));
    }

    @PostMapping("/refresh-token")
    public ResponseEntity<RefreshTokenResponseDto> refreshToken(
            @Valid @RequestBody RefreshTokenRequestDto request,
            ClientInfo clientInfo,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        String clientIp = clientInfo != null ? clientInfo.ipAddress() : null;
        boolean web = AuthCookies.isWebClient(httpRequest);
        String refreshToken = request.refreshToken();
        if ((refreshToken == null || refreshToken.isBlank()) && web) {
            refreshToken = AuthCookies.readCookie(httpRequest, AuthCookies.REFRESH_COOKIE);
        }
        RefreshTokenResponseDto response = authenticationService.refreshToken(
                refreshToken,
                request.deviceId(),
                clientIp
        );
        if (web) {
            authCookies.writeTokens(httpResponse, response.accessToken(), response.refreshToken());
            return ResponseEntity.ok(new RefreshTokenResponseDto(null, null));
        }
        return ResponseEntity.status(HttpStatus.OK).body(response);
    }

    /**
     * Web logout: revokes the session identified by the auth cookies (blacklisting the
     * access token) and clears them. Public so it still clears cookies when the access
     * token has already expired; requires the web client header like every cookie request.
     */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @Valid @RequestBody WebLogoutRequestDto request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        if (!AuthCookies.isWebClient(httpRequest)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
        String accessToken = AuthCookies.readCookie(httpRequest, AuthCookies.ACCESS_COOKIE);
        String refreshToken = AuthCookies.readCookie(httpRequest, AuthCookies.REFRESH_COOKIE);
        try {
            if (accessToken != null || refreshToken != null) {
                authenticationService.logout(accessToken, refreshToken, request.deviceId(), request.isAllDevices());
            }
        } finally {
            authCookies.clear(httpResponse);
        }
        return ResponseEntity.noContent().build();
    }
}

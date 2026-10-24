package me.one_org.melody.Controllers.Authentication;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import me.one_org.melody.Dto.Controllers.Authentication.LoginRequestDto;
import me.one_org.melody.Dto.Controllers.Authentication.LogoutResponseDto;
import me.one_org.melody.Dto.Controllers.Authentication.RefreshTokenRequestDto;
import me.one_org.melody.Dto.Controllers.Authentication.RefreshTokenResponseDto;
import me.one_org.melody.Dto.Controllers.Authentication.RegisterAndLoginResponse;
import me.one_org.melody.Dto.Controllers.Authentication.RegisterRequestDto;
import me.one_org.melody.Dto.Controllers.Authentication.ResendOtpRequestDto;
import me.one_org.melody.Dto.Controllers.Authentication.VerifyOtpRequest;
import me.one_org.melody.Dto.Controllers.Authentication.VerifyOtpResponse;
import me.one_org.melody.Services.Authentication.AuthenticationService;
import me.one_org.melody.Utils.ClientInfoExtractor;

@RestController
@RequestMapping("/auth")
public class AuthenticationController {

    private final AuthenticationService authenticationService;

    public AuthenticationController(AuthenticationService authenticationService) {
        this.authenticationService = authenticationService;
    }

    @PostMapping("/register")
    public ResponseEntity<RegisterAndLoginResponse> register(
            @Valid @RequestBody RegisterRequestDto request,
            HttpServletRequest httpRequest) {
        String clientIp = ClientInfoExtractor.getClientIp(httpRequest);
        String tempToken = authenticationService.register(request, clientIp);
        return ResponseEntity.status(HttpStatus.CREATED).body(new RegisterAndLoginResponse(tempToken));
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<VerifyOtpResponse> verifyOtp(
            @Valid @RequestBody VerifyOtpRequest verifyRequest,
            HttpServletRequest httpRequest) {
        String clientIp = ClientInfoExtractor.getClientIp(httpRequest);
        String userAgent = httpRequest != null ? httpRequest.getHeader("User-Agent") : null;
        String deviceName = ClientInfoExtractor.parseDeviceName(userAgent);

        VerifyOtpResponse response = authenticationService.verifyOtp(
                verifyRequest.tempToken(),
                verifyRequest.otp(),
                verifyRequest.deviceId(),
                deviceName,
                clientIp
        );
        return ResponseEntity.status(HttpStatus.OK).body(response);
    }

    @PostMapping("/resend-otp")
    public ResponseEntity<RegisterAndLoginResponse> resendOtp(
            @Valid @RequestBody ResendOtpRequestDto request,
            HttpServletRequest httpRequest) {
        String clientIp = ClientInfoExtractor.getClientIp(httpRequest);
        String token = authenticationService.resendOtp(request.tempToken(), clientIp);
        return ResponseEntity.status(HttpStatus.OK).body(new RegisterAndLoginResponse(token));
    }

    @PostMapping("/login")
    public ResponseEntity<RegisterAndLoginResponse> login(
            @Valid @RequestBody LoginRequestDto request,
            HttpServletRequest httpRequest) {
        String clientIp = ClientInfoExtractor.getClientIp(httpRequest);
        String tempToken = authenticationService.login(request, clientIp);
        return ResponseEntity.status(HttpStatus.OK).body(new RegisterAndLoginResponse(tempToken));
    }

    @PostMapping("/refresh-token")
    public ResponseEntity<RefreshTokenResponseDto> refreshToken(
            @Valid @RequestBody RefreshTokenRequestDto request,
            HttpServletRequest httpRequest) {
        String clientIp = ClientInfoExtractor.getClientIp(httpRequest);
        RefreshTokenResponseDto response = authenticationService.refreshToken(
                request.refreshToken(),
                request.deviceId(),
                clientIp
        );
        return ResponseEntity.status(HttpStatus.OK).body(response);
    }

    @PostMapping("/logout")
    public ResponseEntity<LogoutResponseDto> logout(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @Valid @RequestBody RefreshTokenRequestDto request) {
        String token = (authHeader != null && authHeader.startsWith("Bearer "))
                ? authHeader.substring(7)
                : null;

        authenticationService.logout(token, request.refreshToken(), request.deviceId());

        return ResponseEntity.ok(new LogoutResponseDto("Logged out successfully"));
    }
}

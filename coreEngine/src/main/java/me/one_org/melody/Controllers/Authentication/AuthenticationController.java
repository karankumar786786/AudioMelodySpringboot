package me.one_org.melody.Controllers.Authentication;


import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import me.one_org.melody.Dto.Controllers.Authentication.LoginRequestDto;
import me.one_org.melody.Dto.Controllers.Authentication.RefreshTokenRequestDto;
import me.one_org.melody.Dto.Controllers.Authentication.RefreshTokenResponseDto;
import me.one_org.melody.Dto.Controllers.Authentication.RegisterAndLoginResponse;
import me.one_org.melody.Dto.Controllers.Authentication.RegisterRequestDto;
import me.one_org.melody.Dto.Controllers.Authentication.VerifyOtpRequest;
import me.one_org.melody.Dto.Controllers.Authentication.VerifyOtpResponse;
import me.one_org.melody.Services.Authentication.AuthenticationService;

@RestController
@RequestMapping("/auth")
public class AuthenticationController {

    private final AuthenticationService authenticationService;

    public AuthenticationController(AuthenticationService authenticationService){
        this.authenticationService = authenticationService;
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
            @Valid @RequestBody VerifyOtpRequest verifyRequest
    ) {
        String effectiveDeviceId = (verifyRequest.deviceId() != null && !verifyRequest.deviceId().isBlank())
                ? verifyRequest.deviceId()
                : (deviceIdHeader != null && !deviceIdHeader.isBlank() ? deviceIdHeader : "default-device");
        VerifyOtpResponse response = authenticationService.verifyOtp(tempToken, verifyRequest.otp(), effectiveDeviceId);
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
            @Valid @RequestBody RefreshTokenRequestDto request
    ) {
        String effectiveDeviceId = (request.deviceId() != null && !request.deviceId().isBlank())
                ? request.deviceId()
                : (deviceIdHeader != null && !deviceIdHeader.isBlank() ? deviceIdHeader : null);
        RefreshTokenResponseDto response = authenticationService.refreshToken(request.refreshToken(), effectiveDeviceId);
        return ResponseEntity.status(HttpStatus.OK).body(response);
    }

    @PostMapping("/logout")
    public ResponseEntity<java.util.Map<String, String>> logout(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-Device-Id", required = false) String deviceIdHeader,
            @RequestBody(required = false) RefreshTokenRequestDto request) {
        String token = (authHeader != null && authHeader.startsWith("Bearer ")) ? authHeader.substring(7) : null;
        String refreshToken = request != null ? request.refreshToken() : null;
        String effectiveDeviceId = (request != null && request.deviceId() != null && !request.deviceId().isBlank())
                ? request.deviceId()
                : deviceIdHeader;
        authenticationService.logout(token, refreshToken, effectiveDeviceId);
        return ResponseEntity.ok(java.util.Map.of("message", "Logged out successfully"));
    }
}

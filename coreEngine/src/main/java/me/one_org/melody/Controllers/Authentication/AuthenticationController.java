package me.one_org.melody.Controllers.Authentication;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import me.one_org.melody.Dto.Controllers.Authentication.AuthTempTokenResponse;
import me.one_org.melody.Dto.Controllers.Authentication.LoginRequestDto;
import me.one_org.melody.Dto.Controllers.Authentication.RefreshTokenRequestDto;
import me.one_org.melody.Dto.Controllers.Authentication.RefreshTokenResponseDto;
import me.one_org.melody.Dto.Controllers.Authentication.RegisterRequestDto;
import me.one_org.melody.Dto.Controllers.Authentication.ResendOtpRequestDto;
import me.one_org.melody.Dto.Controllers.Authentication.VerifyOtpRequest;
import me.one_org.melody.Dto.Controllers.Authentication.VerifyOtpResponse;
import me.one_org.melody.Dto.Internal.ClientInfo;
import me.one_org.melody.Services.Authentication.AuthenticationService;

@RestController
@RequestMapping("/auth")
public class AuthenticationController {

    private final AuthenticationService authenticationService;

    public AuthenticationController(AuthenticationService authenticationService) {
        this.authenticationService = authenticationService;
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
            ClientInfo clientInfo) {
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
            ClientInfo clientInfo) {
        String clientIp = clientInfo != null ? clientInfo.ipAddress() : null;
        RefreshTokenResponseDto response = authenticationService.refreshToken(
                request.refreshToken(),
                request.deviceId(),
                clientIp
        );
        return ResponseEntity.status(HttpStatus.OK).body(response);
    }
}

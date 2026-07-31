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
            @Valid @RequestBody VerifyOtpRequest verifyRequest
        ) {
        VerifyOtpResponse response = authenticationService.verifyOtp(tempToken, verifyRequest.otp());
        return ResponseEntity.status(HttpStatus.OK).body(response);
    }

    @PostMapping("/resend-otp")
    public ResponseEntity<Void> resendOtp(
        @RequestHeader("X-TEMP-TOKEN") String tempToken
    ) {
        authenticationService.resendOtp(tempToken);
        return ResponseEntity.status(HttpStatus.OK).body(null);
    }

    @PostMapping("/login")
    public ResponseEntity<RegisterAndLoginResponse> login(@Valid @RequestBody LoginRequestDto request) {
        String tempToken = authenticationService.login(request);
        return ResponseEntity.status(HttpStatus.OK).body(new RegisterAndLoginResponse(tempToken));
    }
}

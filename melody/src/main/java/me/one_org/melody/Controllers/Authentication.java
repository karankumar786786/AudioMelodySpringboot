package me.one_org.melody.Controllers;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import me.one_org.melody.Dto.RegisterAndLoginResponse;
import me.one_org.melody.Dto.RegisterRequestDto;
import me.one_org.melody.Dto.VerifyOtpResponse;
import me.one_org.melody.Dto.VerifyOtpRequest;
import me.one_org.melody.Services.AuthenticationService;

@RestController
@RequestMapping("/api/v1/Authentication")
public class Authentication {

    @Autowired
    private AuthenticationService authenticationService;

    @PostMapping("/register")
    public ResponseEntity<RegisterAndLoginResponse> register(@Valid @RequestBody RegisterRequestDto request) {
        String tempToken = authenticationService.register(request);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(new RegisterAndLoginResponse(tempToken));
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<VerifyOtpResponse> verifyOtp(
            @RequestHeader("X-TEMP-TOKEN") String tempToken,
            @Valid @RequestBody VerifyOtpRequest verifyRequest
        ) {
        VerifyOtpResponse response = authenticationService.verifyOtp(tempToken, verifyRequest);
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
    public ResponseEntity<RegisterAndLoginResponse> postMethodName(@RequestBody String entity) {
        
        return null;
    }
    
}

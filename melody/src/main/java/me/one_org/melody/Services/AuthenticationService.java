package me.one_org.melody.Services;


import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;



import jakarta.annotation.PostConstruct;
import me.one_org.melody.Cache.Redis;
import me.one_org.melody.Dto.JwtPayloadDto;
import me.one_org.melody.Dto.OtpDataDto;
import me.one_org.melody.Dto.RegisterRequestDto;
import me.one_org.melody.Dto.VerifyOtpResponse;
import me.one_org.melody.Entity.Users;
import me.one_org.melody.Enums.Role;
import me.one_org.melody.Repository.UsersRepository;
import me.one_org.melody.Utils.HmacUtil;
import me.one_org.melody.Utils.JwtUtil;
import me.one_org.melody.Utils.OtpUtil;

import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

@Service
public class AuthenticationService {
    
    private final UsersRepository usersRepository;
    private final JwtUtil jwtUtil;
    private final HmacUtil hmacUtil;
    private final OtpUtil otpUtil;
    private final Redis<OtpDataDto> cache;

    public AuthenticationService(UsersRepository usersRepository, JwtUtil jwtUtil, HmacUtil hmacUtil, OtpUtil otpUtil,
            Redis<OtpDataDto> cache) {
        this.usersRepository = usersRepository;
        this.jwtUtil = jwtUtil;
        this.hmacUtil = hmacUtil;
        this.otpUtil = otpUtil;
        this.cache = cache;
    }

    @PostConstruct
    public void init() {
        cache.of("otp", OtpDataDto.class);
    }


    public String register(RegisterRequestDto request) {
        if (usersRepository.existsByEmail(request.email())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email already in use");
        };
        String tempToken = hmacUtil.hash(request.email()); // tempToken
        String otp = otpUtil.generateOtp();
        // send real mail
        OtpDataDto data = new OtpDataDto(otp,tempToken,request.email(),request.userName());
        cache.set(data.email(),data, Duration.ofMinutes(10));
        return tempToken;
    }
    @SuppressWarnings("null")
    public VerifyOtpResponse verifyOtp(String tempToken, String otp) {
        String email = hmacUtil.getMessageIfValid(tempToken);
        if (email == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Token validation failed");
        }
        Optional<OtpDataDto> otpDto = cache.get(email);
        if (otpDto.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT, "otp is already expired try to start fresh");
        };
        OtpDataDto data = otpDto.get();
        if (!data.email().equals(email)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Token validation failed");
        }
        // Verify OTP
        if (!data.otp().equals(otp)){
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid OTP");
        }
        // Check again to ensure user hasn't registered during validation window
        if (usersRepository.existsByEmail(data.email())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email already in use");
        }
        // Create and save User
        Users user = Users.builder()
                .id(UUID.randomUUID().toString())
                .userName(data.userName())
                .email(data.email())
                .role(Role.USER)
                .build();
        usersRepository.save(user);
        // Clean up cache
        cache.delete(email);
        // Generate access token (1 hour) and refresh token (168 hours / 7 days)
        JwtPayloadDto payload = new JwtPayloadDto(
                user.getId(),
                user.getUserName(),
                user.getEmail(),
                user.getRole()
        );
        String accessToken = jwtUtil.generateToken(payload, 1);
        String refreshToken = jwtUtil.generateToken(payload, 168);
        return new VerifyOtpResponse(accessToken, refreshToken);
    }
    public void resendOtp(String tempToken) {
        String email = hmacUtil.getMessageIfValid(tempToken);
        if (email == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid or expired verification token");
        }
        Optional<OtpDataDto> otpDto = cache.get(email);
        if (otpDto.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid or expired verification token");
        }
        OtpDataDto data = otpDto.get();
        if (!hmacUtil.validate(data.email(), tempToken)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Token validation failed");
        }
        String newOtp = otpUtil.generateOtp();
        System.out.println("============================================");
        System.out.println("NEW OTP (Resent) for " + data.email() + ": " + newOtp);
        System.out.println("============================================");
        OtpDataDto updatedData = new OtpDataDto(newOtp, tempToken, data.email(), data.userName());
        cache.set(data.email(), updatedData, Duration.ofMinutes(10));
    }
}

package me.one_org.melody.Services;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.databind.ObjectMapper;

import me.one_org.melody.Dto.JwtPayloadDto;
import me.one_org.melody.Dto.RegisterRequestDto;
import me.one_org.melody.Dto.RegisterUserCacheDto;
import me.one_org.melody.Dto.VerifyOtpResponse;
import me.one_org.melody.Dto.VerifyOtpRequest;
import me.one_org.melody.Entity.Users;
import me.one_org.melody.Enums.Role;
import me.one_org.melody.Redis.Redis;
import me.one_org.melody.Repository.UsersRepository;
import me.one_org.melody.Utils.HmacUtil;
import me.one_org.melody.Utils.JwtUtil;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
public class AuthenticationService {

    @Autowired
    private UsersRepository usersRepository;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private HmacUtil hmacUtil;

    @Autowired
    private Redis redis;

    private final ObjectMapper objectMapper = new ObjectMapper();

    public String register(RegisterRequestDto request) {
        if (usersRepository.existsByEmail(request.email())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email already in use");
        }

        // Generate tempToken using HMAC and email
        String tempToken = hmacUtil.generate(request.email());

        // Generate 6-digit OTP
        String otp = String.format("%06d", new Random().nextInt(1000000));
        System.out.println("============================================");
        System.out.println("OTP for " + request.email() + ": " + otp);
        System.out.println("============================================");

        // Cache in Redis using tempToken as key
        RegisterUserCacheDto cacheDto = new RegisterUserCacheDto(otp, request);
        redis.set(tempToken, cacheDto, 15, TimeUnit.MINUTES);
        return tempToken;
    }

    public VerifyOtpResponse verifyOtp(String tempToken, VerifyOtpRequest verifyRequest) {
        Object cachedObj = redis.get(tempToken);
        if (cachedObj == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid or expired verification token");
        }

        // Handle deserialization from Redis
        RegisterUserCacheDto cacheDto;
        if (cachedObj instanceof RegisterUserCacheDto) {
            cacheDto = (RegisterUserCacheDto) cachedObj;
        } else {
            try {
                cacheDto = objectMapper.convertValue(cachedObj, RegisterUserCacheDto.class);
            } catch (Exception e) {
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to process cached registration details", e);
            }
        }

        // Verify HMAC token integrity matching cached email
        if (!hmacUtil.validate(cacheDto.registerRequest().email(), tempToken)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Token validation failed");
        }

        // Verify OTP
        if (!cacheDto.otp().equals(verifyRequest.otp())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid OTP");
        }

        // Check again to ensure user hasn't registered during validation window
        if (usersRepository.existsByEmail(cacheDto.registerRequest().email())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email already in use");
        }

        // Create and save User
        Users user = Users.builder()
                .id(UUID.randomUUID().toString())
                .userName(cacheDto.registerRequest().userName())
                .email(cacheDto.registerRequest().email())
                .role(Role.USER)
                .build();
        usersRepository.save(user);

        // Clean up cache
        redis.delete(tempToken);

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
        Object cachedObj = redis.get(tempToken);
        if (cachedObj == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid or expired verification token");
        }

        RegisterUserCacheDto cacheDto;
        if (cachedObj instanceof RegisterUserCacheDto) {
            cacheDto = (RegisterUserCacheDto) cachedObj;
        } else {
            try {
                cacheDto = objectMapper.convertValue(cachedObj, RegisterUserCacheDto.class);
            } catch (Exception e) {
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to process cached registration details", e);
            }
        }

        if (!hmacUtil.validate(cacheDto.registerRequest().email(), tempToken)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Token validation failed");
        }

        String newOtp = String.format("%06d", new Random().nextInt(1000000));
        System.out.println("============================================");
        System.out.println("NEW OTP (Resent) for " + cacheDto.registerRequest().email() + ": " + newOtp);
        System.out.println("============================================");

        RegisterUserCacheDto updatedCacheDto = new RegisterUserCacheDto(newOtp, cacheDto.registerRequest());
        redis.set(tempToken, updatedCacheDto, 15, TimeUnit.MINUTES);
    }
}

package me.one_org.melody.Services.Authentication;

import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Cache.Redis;
import me.one_org.melody.Dto.Controllers.Authentication.LoginRequestDto;
import me.one_org.melody.Dto.Controllers.Authentication.RefreshTokenResponseDto;
import me.one_org.melody.Dto.Controllers.Authentication.RegisterRequestDto;
import me.one_org.melody.Dto.Controllers.Authentication.VerifyOtpResponse;
import me.one_org.melody.Dto.Internal.JwtPayloadDto;
import me.one_org.melody.Dto.Internal.OtpDataDto;
import me.one_org.melody.Entity.UsersEntity;
import me.one_org.melody.Enums.RoleEnum;
import me.one_org.melody.Exceptions.BadRequestException;
import me.one_org.melody.Exceptions.ConflictException;
import me.one_org.melody.Exceptions.ResourceNotFoundException;
import me.one_org.melody.Exceptions.UnauthorizedException;
import me.one_org.melody.Repository.UsersRepository;
import me.one_org.melody.Services.General.PaginationMetaDataService;
import me.one_org.melody.Utils.HmacUtil;
import me.one_org.melody.Utils.JwtUtil;
import me.one_org.melody.Utils.OtpUtil;

@Service
@Slf4j
public class AuthenticationService {
    
    private final UsersRepository usersRepository;
    private final JwtUtil jwtUtil;
    private final HmacUtil hmacUtil;
    private final OtpUtil otpUtil;
    private final Redis<OtpDataDto> cache;
    private final PaginationMetaDataService paginationMetaDataService;

    public AuthenticationService(UsersRepository usersRepository, JwtUtil jwtUtil, HmacUtil hmacUtil, OtpUtil otpUtil,
            Redis<OtpDataDto> cache, PaginationMetaDataService paginationMetaDataService) {
        this.usersRepository = usersRepository;
        this.jwtUtil = jwtUtil;
        this.hmacUtil = hmacUtil;
        this.otpUtil = otpUtil;
        this.cache = cache.of("otp", OtpDataDto.class);
        this.paginationMetaDataService = paginationMetaDataService;
    }

    public String register(RegisterRequestDto request) {
        if (usersRepository.existsByEmail(request.email())) {
            throw new ConflictException("Email already in use");
        }
        String tempToken = hmacUtil.hash(request.email());
        String otp = otpUtil.generateOtp();
        OtpDataDto data = new OtpDataDto(otp, tempToken, request.email(), request.userName());
        log.info(otp);
        cache.set(data.email(), data, Duration.ofMinutes(10));
        return tempToken;
    }

    public String login(LoginRequestDto request) {
        UsersEntity user = usersRepository.findByEmail(request.email())
                .orElseThrow(() -> new ResourceNotFoundException("User not found with email: " + request.email()));
        String tempToken = hmacUtil.hash(user.getEmail());
        String otp = otpUtil.generateOtp();
        OtpDataDto data = new OtpDataDto(otp, tempToken, user.getEmail(), user.getUserName());
        log.info("OTP for login ({}): {}", user.getEmail(), otp);
        cache.set(data.email(), data, Duration.ofMinutes(10));
        return tempToken;
    }

    public VerifyOtpResponse verifyOtp(String tempToken, String otp) {
        String email = hmacUtil.getMessageIfValid(tempToken);
        if (email == null) {
            throw new BadRequestException("Token validation failed");
        }
        Optional<OtpDataDto> otpDto = cache.get(email);
        if (otpDto.isEmpty()) {
            throw new BadRequestException("OTP has expired. Please request a new verification code");
        }
        OtpDataDto data = otpDto.get();
        if (!data.email().equals(email)) {
            throw new BadRequestException("Token validation failed");
        }
        if (!data.otp().equals(otp)){
            throw new BadRequestException("Invalid OTP");
        }

        Optional<UsersEntity> existingUser = usersRepository.findByEmail(data.email());
        UsersEntity user;
        if (existingUser.isPresent()) {
            user = existingUser.get();
        } else {
            user = UsersEntity.builder()
                    .id(UUID.randomUUID().toString())
                    .userName(data.userName())
                    .email(data.email())
                    .role(RoleEnum.USER)
                    .build();
            usersRepository.save(user);
            paginationMetaDataService.incrementStatus("UsersEntity", user.getStatus());
        }
        cache.delete(email);

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
            throw new BadRequestException("Invalid or expired verification token");
        }
        Optional<OtpDataDto> otpDto = cache.get(email);
        if (otpDto.isEmpty()) {
            throw new BadRequestException("Invalid or expired verification token");
        }
        OtpDataDto data = otpDto.get();
        if (!hmacUtil.validate(data.email(), tempToken)) {
            throw new BadRequestException("Token validation failed");
        }
        String newOtp = otpUtil.generateOtp();
        System.out.println("============================================");
        System.out.println("NEW OTP (Resent) for " + data.email() + ": " + newOtp);
        System.out.println("============================================");
        OtpDataDto updatedData = new OtpDataDto(newOtp, tempToken, data.email(), data.userName());
        cache.set(data.email(), updatedData, Duration.ofMinutes(10));
    }

    public RefreshTokenResponseDto refreshToken(String refreshToken) {
        try {
            JwtPayloadDto payload = jwtUtil.validateAndGetPayload(refreshToken);
            UsersEntity user = usersRepository.findById(payload.id())
                    .orElseThrow(() -> new UnauthorizedException("User not found or inactive"));

            JwtPayloadDto newPayload = new JwtPayloadDto(
                    user.getId(),
                    user.getUserName(),
                    user.getEmail(),
                    user.getRole()
            );

            String newAccessToken = jwtUtil.generateToken(newPayload, 1);
            String newRefreshToken = jwtUtil.generateToken(newPayload, 168);

            return new RefreshTokenResponseDto(newAccessToken, newRefreshToken);
        } catch (UnauthorizedException e) {
            throw e;
        } catch (Exception e) {
            throw new UnauthorizedException("Invalid or expired refresh token");
        }
    }
}

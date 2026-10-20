package me.one_org.melody.Services.Authentication;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Cache.Redis;
import me.one_org.melody.Dto.Controllers.Authentication.LoginRequestDto;
import me.one_org.melody.Dto.Controllers.Authentication.RefreshTokenResponseDto;
import me.one_org.melody.Dto.Controllers.Authentication.RegisterRequestDto;
import me.one_org.melody.Dto.Controllers.Authentication.VerifyOtpResponse;
import me.one_org.melody.Dto.Internal.JwtPayloadDto;
import me.one_org.melody.Dto.Internal.OtpDataDto;
import me.one_org.melody.Entity.Session;
import me.one_org.melody.Entity.User;
import me.one_org.melody.Enums.PurposeEnum;
import me.one_org.melody.Exceptions.BadRequestException;
import me.one_org.melody.Exceptions.ConflictException;
import me.one_org.melody.Exceptions.ResourceNotFoundException;
import me.one_org.melody.Exceptions.UnauthorizedException;
import me.one_org.melody.Repository.SessionRepository;
import me.one_org.melody.Repository.UsersRepository;
import me.one_org.melody.Security.CustomUserDetails;
import me.one_org.melody.Services.General.PaginationMetaDataService;
import me.one_org.melody.Utils.HmacUtil;
import me.one_org.melody.Utils.JwtUtil;
import me.one_org.melody.Utils.MailUtil;
import me.one_org.melody.Utils.OtpUtil;

@Service
@Slf4j
public class AuthenticationService {

    private final UsersRepository usersRepository;
    private final SessionRepository sessionRepository;
    private final JwtUtil jwtUtil;
    private final HmacUtil hmacUtil;
    private final OtpUtil otpUtil;
    private final Redis<OtpDataDto> cache;
    private final PaginationMetaDataService paginationMetaDataService;
    private final MailUtil mailUtil;
    private final org.springframework.context.ApplicationEventPublisher eventPublisher;

    public AuthenticationService(UsersRepository usersRepository, SessionRepository sessionRepository,
            JwtUtil jwtUtil, HmacUtil hmacUtil, OtpUtil otpUtil,
            Redis<OtpDataDto> cache, PaginationMetaDataService paginationMetaDataService, MailUtil mailUtil,
            org.springframework.context.ApplicationEventPublisher eventPublisher) {
        this.usersRepository = usersRepository;
        this.sessionRepository = sessionRepository;
        this.jwtUtil = jwtUtil;
        this.hmacUtil = hmacUtil;
        this.otpUtil = otpUtil;
        this.cache = cache.of("otp", OtpDataDto.class);
        this.paginationMetaDataService = paginationMetaDataService;
        this.mailUtil = mailUtil;
        this.eventPublisher = eventPublisher;
    }

    public String register(RegisterRequestDto request) {
        if (usersRepository.existsByEmail(request.email())) {
            throw new ConflictException("Email already in use");
        }
        String tempToken = hmacUtil.hash(request.email());
        String otp = otpUtil.generateOtp();
        OtpDataDto data = new OtpDataDto(otp, tempToken, request.email(), request.userName(), PurposeEnum.REGISTER);
        mailUtil.sendOtp(request.email(), PurposeEnum.REGISTER.name(), otp);
        cache.set(data.email(), data, Duration.ofMinutes(10));
        return tempToken;
    }

    public String login(LoginRequestDto request) {
        User user = usersRepository.findByEmail(request.email())
                .orElseThrow(() -> new ResourceNotFoundException("User not found with email: " + request.email()));
        String tempToken = hmacUtil.hash(user.getEmail());
        String otp = otpUtil.generateOtp();
        OtpDataDto data = new OtpDataDto(otp, tempToken, user.getEmail(), user.getUserName(), PurposeEnum.LOGIN);
        mailUtil.sendOtp(user.getEmail(), PurposeEnum.LOGIN.name(), otp);
        cache.set(data.email(), data, Duration.ofMinutes(10));
        return tempToken;
    }

    @Transactional
    public VerifyOtpResponse verifyOtp(String tempToken, String otp, String deviceId) {
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
        if (!data.otp().equals(otp)) {
            throw new BadRequestException("Invalid OTP");
        }

        Optional<User> existingUser = usersRepository.findByEmail(data.email());
        User user;
        boolean isNewUser = existingUser.isEmpty();
        if (existingUser.isPresent()) {
            user = existingUser.get();
        } else {
            user = User.builder()
                    .id(UUID.randomUUID().toString())
                    .userName(data.userName())
                    .email(data.email())
                    .build();
            usersRepository.save(user);
            paginationMetaDataService.incrementStatus("UsersEntity", user.getStatus());
            eventPublisher.publishEvent(new me.one_org.melody.Events.TelemetryEvents.UserRegisteredEvent(user.getId()));
        }
        cache.delete(email);

        CustomUserDetails userDetails = new CustomUserDetails(user);
        org.springframework.security.core.Authentication authentication =
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                        userDetails,
                        null,
                        userDetails.getAuthorities()
                );
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(authentication);

        // 5-minute access token and 7-day refresh token
        String accessToken = jwtUtil.generateAccessToken(authentication);
        String refreshToken = jwtUtil.generateRefreshToken(authentication);

        // Persist session for user & deviceId
        String safeDeviceId = (deviceId != null && !deviceId.isBlank()) ? deviceId : "default-device";
        LocalDateTime expiresAt = LocalDateTime.now().plusDays(30);

        Session session = sessionRepository.findByUserIdAndDeviceId(user.getId(), safeDeviceId)
                .orElseGet(() -> Session.builder()
                        .id(UUID.randomUUID().toString())
                        .user(user)
                        .deviceId(safeDeviceId)
                        .build());

        session.setRefreshToken(refreshToken);
        session.setPreviousRefreshToken(null);
        session.setExpiresAt(expiresAt);
        sessionRepository.save(session);

        return new VerifyOtpResponse(accessToken, refreshToken, isNewUser);
    }

    public VerifyOtpResponse verifyOtp(String tempToken, String otp) {
        return verifyOtp(tempToken, otp, "default-device");
    }

    public String resendOtp(String tempToken) {
        String email = hmacUtil.getMessageIfValid(tempToken);
        if (email == null) {
            throw new BadRequestException("Invalid or expired verification token");
        }
        Optional<OtpDataDto> otpDto = cache.get(email);
        OtpDataDto data;
        if (otpDto.isPresent()) {
            data = otpDto.get();
            if (!hmacUtil.validate(data.email(), tempToken)) {
                throw new BadRequestException("Token validation failed");
            }
        } else {
            Optional<User> existingUser = usersRepository.findByEmail(email);
            if (existingUser.isPresent()) {
                User user = existingUser.get();
                data = new OtpDataDto(
                        otpUtil.generateOtp(),
                        tempToken,
                        user.getEmail(),
                        user.getUserName() != null ? user.getUserName() : "User",
                        PurposeEnum.LOGIN);
            } else {
                throw new BadRequestException("Verification session has expired. Please sign up or log in again");
            }
        }

        String newOtp = otpUtil.generateOtp();
        PurposeEnum purpose = data.Purpose() != null ? data.Purpose() : PurposeEnum.LOGIN;
        OtpDataDto updatedData = new OtpDataDto(newOtp, tempToken, data.email(), data.userName(), purpose);
        mailUtil.sendOtp(data.email(), purpose.name(), newOtp);
        cache.set(data.email(), updatedData, Duration.ofMinutes(10));
        return tempToken;
    }

    @Transactional
    public RefreshTokenResponseDto refreshToken(String refreshToken, String deviceId) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new UnauthorizedException("Refresh token is required");
        }
        try {
            JwtPayloadDto payload = jwtUtil.validateAndGetPayload(refreshToken);
            User user = usersRepository.findById(payload.id())
                    .orElseThrow(() -> new UnauthorizedException("User not found or inactive"));

            if (user.getStatus() != me.one_org.melody.Enums.StatusEnum.ACTIVE) {
                throw new UnauthorizedException("User account is inactive or blocked");
            }

            // Look up session by user + device, or by current/previous refresh token
            Session session = null;
            if (deviceId != null && !deviceId.isBlank()) {
                session = sessionRepository.findByUserIdAndDeviceId(user.getId(), deviceId).orElse(null);
            }
            if (session == null) {
                session = sessionRepository.findByUserIdAndCurrentOrPreviousRefreshToken(user.getId(), refreshToken).orElse(null);
            }
            if (session == null) {
                session = sessionRepository.findByCurrentOrPreviousRefreshToken(refreshToken).orElse(null);
            }
            if (session == null) {
                // Grace fallback: check user's most recent session updated in last 60 seconds
                List<Session> recentSessions = sessionRepository.findByUserIdOrderByUpdatedAtDesc(user.getId());
                if (!recentSessions.isEmpty()) {
                    Session candidate = recentSessions.get(0);
                    if (candidate.getUpdatedAt() != null && candidate.getUpdatedAt().isAfter(LocalDateTime.now().minusSeconds(60))) {
                        session = candidate;
                    }
                }
            }

            if (session == null) {
                throw new UnauthorizedException("Session not found or expired");
            }

            // Check if this is the previous refresh token within grace period (e.g. concurrent requests during rotation)
            boolean isPreviousToken = refreshToken.equals(session.getPreviousRefreshToken());
            boolean isCurrentToken = refreshToken.equals(session.getRefreshToken());

            if (isPreviousToken) {
                // Grace period: within 60 seconds of last refresh, return current valid tokens without re-rotating or failing
                if (session.getUpdatedAt() != null && session.getUpdatedAt().isAfter(LocalDateTime.now().minusSeconds(60))) {
                    CustomUserDetails userDetails = new CustomUserDetails(user);
                    org.springframework.security.core.Authentication authentication =
                            new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                                    userDetails,
                                    null,
                                    userDetails.getAuthorities()
                            );
                    String newAccessToken = jwtUtil.generateAccessToken(authentication);
                    return new RefreshTokenResponseDto(newAccessToken, session.getRefreshToken());
                }
                sessionRepository.delete(session);
                throw new UnauthorizedException("Refresh token has expired due to rotation");
            }

            if (!isCurrentToken) {
                // Neither current nor previous token matches. If session was refreshed in last 60 seconds, tolerate concurrent race
                if (session.getUpdatedAt() != null && session.getUpdatedAt().isAfter(LocalDateTime.now().minusSeconds(60))) {
                    CustomUserDetails userDetails = new CustomUserDetails(user);
                    org.springframework.security.core.Authentication authentication =
                            new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                                    userDetails,
                                    null,
                                    userDetails.getAuthorities()
                            );
                    String newAccessToken = jwtUtil.generateAccessToken(authentication);
                    return new RefreshTokenResponseDto(newAccessToken, session.getRefreshToken());
                }

                sessionRepository.delete(session);
                throw new UnauthorizedException("Invalid or reused refresh token");
            }

            // Check session expiration
            if (session.getExpiresAt().isBefore(LocalDateTime.now())) {
                sessionRepository.delete(session);
                throw new UnauthorizedException("Session has expired");
            }

            CustomUserDetails userDetails = new CustomUserDetails(user);
            org.springframework.security.core.Authentication authentication =
                    new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                            userDetails,
                            null,
                            userDetails.getAuthorities()
                    );
            org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(authentication);

            // Reissue: 2-hour access token and rotated 30-day refresh token
            String newAccessToken = jwtUtil.generateAccessToken(authentication);
            String newRefreshToken = jwtUtil.generateRefreshToken(authentication);

            session.setPreviousRefreshToken(session.getRefreshToken());
            session.setRefreshToken(newRefreshToken);
            session.setExpiresAt(LocalDateTime.now().plusDays(30));
            sessionRepository.save(session);

            return new RefreshTokenResponseDto(newAccessToken, newRefreshToken);
        } catch (UnauthorizedException e) {
            throw e;
        } catch (Exception e) {
            throw new UnauthorizedException("Invalid or expired refresh token: " + e.getMessage());
        }
    }

    public RefreshTokenResponseDto refreshToken(String refreshToken) {
        return refreshToken(refreshToken, null);
    }

    @Transactional
    public void logout(String accessToken, String refreshToken, String deviceId) {
        if (refreshToken != null && !refreshToken.isBlank()) {
            sessionRepository.deleteByRefreshToken(refreshToken);
        }
        if (accessToken != null && !accessToken.isBlank()) {
            try {
                JwtPayloadDto payload = jwtUtil.validateAndGetPayload(accessToken);
                if (deviceId != null && !deviceId.isBlank()) {
                    sessionRepository.deleteByUserIdAndDeviceId(payload.id(), deviceId);
                } else if (refreshToken == null || refreshToken.isBlank()) {
                    sessionRepository.deleteByUserId(payload.id());
                }
            } catch (Exception ignored) {
            }
        }
    }

    public void logout(String token) {
        logout(token, null, null);
    }
}

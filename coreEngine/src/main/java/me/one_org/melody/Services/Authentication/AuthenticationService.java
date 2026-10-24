package me.one_org.melody.Services.Authentication;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Cache.Redis;
import me.one_org.melody.Dto.Controllers.Authentication.LoginRequestDto;
import me.one_org.melody.Dto.Controllers.Authentication.RefreshTokenResponseDto;
import me.one_org.melody.Dto.Controllers.Authentication.RegisterRequestDto;
import me.one_org.melody.Dto.Controllers.Authentication.SessionStatusDto;
import me.one_org.melody.Dto.Controllers.Authentication.VerifyOtpResponse;
import me.one_org.melody.Dto.Internal.JwtPayloadDto;
import me.one_org.melody.Dto.Internal.OtpDataDto;
import me.one_org.melody.Dto.Queue.MailQueueDto;
import me.one_org.melody.Entity.Session;
import me.one_org.melody.Entity.User;
import me.one_org.melody.Enums.PurposeEnum;
import me.one_org.melody.Exceptions.BadRequestException;
import me.one_org.melody.Exceptions.ConflictException;
import me.one_org.melody.Exceptions.ResourceNotFoundException;
import me.one_org.melody.Exceptions.UnauthorizedException;
import me.one_org.melody.Queue.MailQueue;
import me.one_org.melody.Repository.SessionRepository;
import me.one_org.melody.Repository.UsersRepository;
import me.one_org.melody.Security.CustomUserDetails;
import me.one_org.melody.Services.General.PaginationMetaDataService;
import me.one_org.melody.Utils.HmacUtil;
import me.one_org.melody.Utils.JwtUtil;
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
    private final MailQueue mailQueue;
    private final ApplicationEventPublisher eventPublisher;
    private final RateLimiterService rateLimiterService;
    private final TokenBlacklistService tokenBlacklistService;

    @Autowired
    public AuthenticationService(UsersRepository usersRepository, SessionRepository sessionRepository,
            JwtUtil jwtUtil, HmacUtil hmacUtil, OtpUtil otpUtil,
            Redis<OtpDataDto> cache, PaginationMetaDataService paginationMetaDataService, MailQueue mailQueue,
            ApplicationEventPublisher eventPublisher,
            RateLimiterService rateLimiterService,
            TokenBlacklistService tokenBlacklistService) {
        this.usersRepository = usersRepository;
        this.sessionRepository = sessionRepository;
        this.jwtUtil = jwtUtil;
        this.hmacUtil = hmacUtil;
        this.otpUtil = otpUtil;
        this.cache = cache.of("otp", OtpDataDto.class);
        this.paginationMetaDataService = paginationMetaDataService;
        this.mailQueue = mailQueue;
        this.eventPublisher = eventPublisher;
        this.rateLimiterService = rateLimiterService;
        this.tokenBlacklistService = tokenBlacklistService;
    }

    public AuthenticationService(UsersRepository usersRepository, SessionRepository sessionRepository,
            JwtUtil jwtUtil, HmacUtil hmacUtil, OtpUtil otpUtil,
            Redis<OtpDataDto> cache, PaginationMetaDataService paginationMetaDataService, MailQueue mailQueue,
            ApplicationEventPublisher eventPublisher) {
        this(usersRepository, sessionRepository, jwtUtil, hmacUtil, otpUtil,
             cache, paginationMetaDataService, mailQueue, eventPublisher, null, null);
    }

    public String register(RegisterRequestDto request) {
        return register(request, null);
    }

    public String register(RegisterRequestDto request, String clientIp) {
        if (rateLimiterService != null && clientIp != null && !clientIp.isBlank()) {
            rateLimiterService.checkRateLimit("ratelimit:auth:register:" + clientIp, 10, Duration.ofMinutes(1));
        }

        if (usersRepository.existsByEmail(request.email())) {
            throw new ConflictException("Email already in use");
        }
        String tempToken = hmacUtil.hashTempToken(request.email());
        if (tempToken == null || tempToken.isBlank()) {
            tempToken = hmacUtil.hash(request.email());
        }
        String otp = otpUtil.generateOtp();
        OtpDataDto data = new OtpDataDto(otp, tempToken, request.email(), request.userName(), PurposeEnum.REGISTER, 0);
        MailQueueDto mqd = new MailQueueDto(request.email(), PurposeEnum.REGISTER.name(), otp);
        mailQueue.queueMail(mqd);
        cache.set(data.email(), data, Duration.ofMinutes(10));
        return tempToken;
    }

    public String login(LoginRequestDto request) {
        return login(request, null);
    }

    public String login(LoginRequestDto request, String clientIp) {
        if (rateLimiterService != null && clientIp != null && !clientIp.isBlank()) {
            rateLimiterService.checkRateLimit("ratelimit:auth:login:" + clientIp, 15, Duration.ofMinutes(1));
        }

        User user = usersRepository.findByEmail(request.email())
                .orElseThrow(() -> new ResourceNotFoundException("User not found with email: " + request.email()));
        String tempToken = hmacUtil.hashTempToken(user.getEmail());
        if (tempToken == null || tempToken.isBlank()) {
            tempToken = hmacUtil.hash(user.getEmail());
        }
        String otp = otpUtil.generateOtp();
        OtpDataDto data = new OtpDataDto(otp, tempToken, user.getEmail(), user.getUserName(), PurposeEnum.LOGIN, 0);
        MailQueueDto mqd = new MailQueueDto(user.getEmail(), PurposeEnum.LOGIN.name(), otp);
        mailQueue.queueMail(mqd);
        cache.set(data.email(), data, Duration.ofMinutes(10));
        return tempToken;
    }

    @Transactional
    public VerifyOtpResponse verifyOtp(String tempToken, String otp, String deviceId) {
        return verifyOtp(tempToken, otp, deviceId, null, null);
    }

    @Transactional
    public VerifyOtpResponse verifyOtp(String tempToken, String otp, String deviceId, String deviceName, String clientIp) {
        if (rateLimiterService != null && clientIp != null && !clientIp.isBlank()) {
            rateLimiterService.checkRateLimit("ratelimit:auth:verify-otp:" + clientIp, 20, Duration.ofMinutes(1));
        }

        String email = hmacUtil.getTempTokenEmail(tempToken);
        if (email == null) {
            email = hmacUtil.getMessageIfValid(tempToken);
        }
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
            int attempts = data.attempts() + 1;
            if (attempts >= 5) {
                cache.delete(email);
                throw new BadRequestException("Maximum verification attempts exceeded. Please request a new verification code.");
            }
            cache.set(data.email(), new OtpDataDto(data.otp(), data.tempToken(), data.email(), data.userName(), data.Purpose(), attempts), Duration.ofMinutes(10));
            throw new BadRequestException("Invalid OTP. " + (5 - attempts) + " attempt(s) remaining.");
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
        Authentication auth = new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());

        // 5-minute access token and 7-day refresh token
        String accessToken = jwtUtil.generateAccessToken(auth);
        String refreshToken = jwtUtil.generateRefreshToken(auth);

        if (deviceId == null || deviceId.isBlank()) {
            throw new BadRequestException("Device ID is required");
        }
        LocalDateTime expiresAt = LocalDateTime.now().plusDays(7);

        Session session = sessionRepository.findByUserIdAndDeviceId(user.getId(), deviceId)
                .orElseGet(() -> Session.builder()
                        .id(UUID.randomUUID().toString())
                        .user(user)
                        .deviceId(deviceId)
                        .build());

        session.setRefreshToken(refreshToken);
        session.setExpiresAt(expiresAt);
        if (deviceName != null && !deviceName.isBlank()) {
            session.setDeviceName(deviceName);
        }
        if (clientIp != null && !clientIp.isBlank()) {
            session.setIpAddress(clientIp);
        }
        session.setLastActiveAt(LocalDateTime.now());
        sessionRepository.save(session);

        eventPublisher.publishEvent(new me.one_org.melody.Events.TelemetryEvents.UserLoginEvent(
                user.getId(),
                user.getEmail(),
                deviceId,
                deviceName != null ? deviceName : "Unknown Device",
                clientIp != null ? clientIp : "Unknown IP"
        ));

        return new VerifyOtpResponse(accessToken, refreshToken, isNewUser);
    }

    public String resendOtp(String tempToken) {
        return resendOtp(tempToken, null);
    }

    public String resendOtp(String tempToken, String clientIp) {
        if (rateLimiterService != null && clientIp != null && !clientIp.isBlank()) {
            rateLimiterService.checkRateLimit("ratelimit:auth:resend-otp:" + clientIp, 5, Duration.ofMinutes(1));
        }

        String email = hmacUtil.getTempTokenEmail(tempToken);
        if (email == null) {
            email = hmacUtil.getMessageIfValid(tempToken);
        }
        if (email == null) {
            throw new BadRequestException("Invalid or expired verification token");
        }

        if (rateLimiterService != null) {
            rateLimiterService.checkCooldown("cooldown:resend_otp:" + email);
        }

        Optional<OtpDataDto> otpDto = cache.get(email);
        OtpDataDto data;
        if (otpDto.isPresent()) {
            data = otpDto.get();
        } else {
            Optional<User> existingUser = usersRepository.findByEmail(email);
            if (existingUser.isPresent()) {
                User user = existingUser.get();
                data = new OtpDataDto(
                        otpUtil.generateOtp(),
                        tempToken,
                        user.getEmail(),
                        user.getUserName() != null ? user.getUserName() : "User",
                        PurposeEnum.LOGIN,
                        0);
            } else {
                throw new BadRequestException("Verification session has expired. Please sign up or log in again");
            }
        }

        String newOtp = otpUtil.generateOtp();
        PurposeEnum purpose = data.Purpose() != null ? data.Purpose() : PurposeEnum.LOGIN;
        String newTempToken = hmacUtil.hashTempToken(data.email());
        if (newTempToken == null || newTempToken.isBlank()) {
            newTempToken = tempToken;
        }

        OtpDataDto updatedData = new OtpDataDto(newOtp, newTempToken, data.email(), data.userName(), purpose, 0);
        MailQueueDto mqd = new MailQueueDto(data.email(), purpose.name(), newOtp);
        mailQueue.queueMail(mqd);
        cache.set(data.email(), updatedData, Duration.ofMinutes(10));

        if (rateLimiterService != null) {
            rateLimiterService.setCooldown("cooldown:resend_otp:" + email, Duration.ofSeconds(60));
        }

        return newTempToken;
    }

    @Transactional
    public RefreshTokenResponseDto refreshToken(String refreshToken, String deviceId) {
        return refreshToken(refreshToken, deviceId, null);
    }

    @Transactional
    public RefreshTokenResponseDto refreshToken(String refreshToken, String deviceId, String clientIp) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new UnauthorizedException("Refresh token is required");
        }
        if (deviceId == null || deviceId.isBlank()) {
            throw new UnauthorizedException("Device ID is required");
        }
        try {
            JwtPayloadDto payload = jwtUtil.validateAndGetPayload(refreshToken);
            User user = usersRepository.findById(payload.id())
                    .orElseThrow(() -> new UnauthorizedException("User not found or inactive"));

            if (user.getStatus() != me.one_org.melody.Enums.StatusEnum.ACTIVE) {
                throw new UnauthorizedException("User account is inactive or blocked");
            }

            Session session = sessionRepository.findByUserIdAndDeviceId(user.getId(), deviceId)
                    .orElseThrow(() -> new UnauthorizedException("Session not found for device"));

            // Verify refresh token match to prevent reuse of old/rotated tokens
            if (!session.getRefreshToken().equals(refreshToken)) {
                sessionRepository.delete(session);
                throw new UnauthorizedException("Invalid or reused refresh token");
            }

            // Check session expiration
            if (session.getExpiresAt().isBefore(LocalDateTime.now())) {
                sessionRepository.delete(session);
                throw new UnauthorizedException("Session has expired");
            }

            CustomUserDetails userDetails = new CustomUserDetails(user);
            Authentication auth = new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());

            // Reissue: 5-minute access token and rotated 7-day refresh token
            String newAccessToken = jwtUtil.generateAccessToken(auth);
            String newRefreshToken = jwtUtil.generateRefreshToken(auth);

            session.setRefreshToken(newRefreshToken);
            session.setExpiresAt(LocalDateTime.now().plusDays(7));
            if (clientIp != null && !clientIp.isBlank()) {
                session.setIpAddress(clientIp);
            }
            session.setLastActiveAt(LocalDateTime.now());
            sessionRepository.save(session);

            return new RefreshTokenResponseDto(newAccessToken, newRefreshToken);
        } catch (UnauthorizedException e) {
            throw e;
        } catch (Exception e) {
            throw new UnauthorizedException("Invalid or expired refresh token: " + e.getMessage());
        }
    }

    @Transactional
    public void logout(String accessToken, String refreshToken, String deviceId) {
        logout(accessToken, refreshToken, deviceId, false);
    }

    @Transactional
    public void logout(String accessToken, String refreshToken, String deviceId, boolean allDevices) {
        if (deviceId == null || deviceId.isBlank()) {
            throw new BadRequestException("Device ID is required");
        }

        // Instant access token revocation via Redis blacklist
        if (accessToken != null && !accessToken.isBlank() && tokenBlacklistService != null) {
            String jti = jwtUtil.extractJti(accessToken);
            if (jti != null && !jti.isBlank()) {
                long remainingSeconds = jwtUtil.getRemainingSeconds(accessToken);
                if (remainingSeconds > 0) {
                    tokenBlacklistService.blacklistToken(jti, Duration.ofSeconds(remainingSeconds));
                }
            }
        }

        String userId = null;
        if (accessToken != null && !accessToken.isBlank()) {
            try {
                JwtPayloadDto payload = jwtUtil.validateAndGetPayload(accessToken);
                userId = payload.id();
            } catch (Exception ignored) {
            }
        }
        if (userId == null && refreshToken != null && !refreshToken.isBlank()) {
            try {
                JwtPayloadDto payload = jwtUtil.validateAndGetPayload(refreshToken);
                userId = payload.id();
            } catch (Exception ignored) {
            }
        }

        if (allDevices) {
            if (userId != null && !userId.isBlank()) {
                sessionRepository.deleteByUserId(userId);
            } else if (refreshToken != null && !refreshToken.isBlank()) {
                sessionRepository.findByRefreshToken(refreshToken)
                        .ifPresent(s -> sessionRepository.deleteByUserId(s.getUser().getId()));
            }
        } else {
            if (refreshToken != null && !refreshToken.isBlank()) {
                sessionRepository.deleteByRefreshToken(refreshToken);
            }
            if (userId != null && !userId.isBlank()) {
                sessionRepository.deleteByUserIdAndDeviceId(userId, deviceId);
            }
        }
    }

    public SessionStatusDto getSessionStatus(String accessToken) {
        if (accessToken == null || accessToken.isBlank()) {
            return SessionStatusDto.unauthenticated();
        }
        try {
            String jti = jwtUtil.extractJti(accessToken);
            if (jti != null && tokenBlacklistService != null && tokenBlacklistService.isBlacklisted(jti)) {
                return SessionStatusDto.unauthenticated();
            }
            JwtPayloadDto payload = jwtUtil.validateAndGetPayload(accessToken);
            if (payload == null || payload.id() == null) {
                return SessionStatusDto.unauthenticated();
            }
            return SessionStatusDto.authenticated(payload.id(), payload.email(), payload.userName());
        } catch (Exception e) {
            return SessionStatusDto.unauthenticated();
        }
    }
}

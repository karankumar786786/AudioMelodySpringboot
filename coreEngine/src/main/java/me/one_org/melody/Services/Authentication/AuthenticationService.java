package me.one_org.melody.Services.Authentication;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
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
    private final org.springframework.context.ApplicationEventPublisher eventPublisher;

    public AuthenticationService(UsersRepository usersRepository, SessionRepository sessionRepository,
            JwtUtil jwtUtil, HmacUtil hmacUtil, OtpUtil otpUtil,
            Redis<OtpDataDto> cache, PaginationMetaDataService paginationMetaDataService, MailQueue mailQueue,
            org.springframework.context.ApplicationEventPublisher eventPublisher) {
        this.usersRepository = usersRepository;
        this.sessionRepository = sessionRepository;
        this.jwtUtil = jwtUtil;
        this.hmacUtil = hmacUtil;
        this.otpUtil = otpUtil;
        this.cache = cache.of("otp", OtpDataDto.class);
        this.paginationMetaDataService = paginationMetaDataService;
        this.mailQueue = mailQueue;
        this.eventPublisher = eventPublisher;
    }

    public String register(RegisterRequestDto request) {
        if (usersRepository.existsByEmail(request.email())) {
            throw new ConflictException("Email already in use");
        }
        String tempToken = hmacUtil.hash(request.email());
        String otp = otpUtil.generateOtp();
        OtpDataDto data = new OtpDataDto(otp, tempToken, request.email(), request.userName(), PurposeEnum.REGISTER);
        MailQueueDto mqd = new MailQueueDto(request.email(), PurposeEnum.REGISTER.name(), otp);
        mailQueue.queueMail(mqd);
        cache.set(data.email(), data, Duration.ofMinutes(10));
        return tempToken;
    }

    public String login(LoginRequestDto request) {
        User user = usersRepository.findByEmail(request.email())
                .orElseThrow(() -> new ResourceNotFoundException("User not found with email: " + request.email()));
        String tempToken = hmacUtil.hash(user.getEmail());
        String otp = otpUtil.generateOtp();
        OtpDataDto data = new OtpDataDto(otp, tempToken, user.getEmail(), user.getUserName(), PurposeEnum.LOGIN);
        MailQueueDto mqd = new MailQueueDto(user.getEmail(), PurposeEnum.LOGIN.name(), otp);
        mailQueue.queueMail(mqd);
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
        Authentication auth = new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());

        // 5-minute access token and 7-day refresh token
        String accessToken = jwtUtil.generateAccessToken(auth);
        String refreshToken = jwtUtil.generateRefreshToken(auth);

        // Persist session for user & deviceId
        String safeDeviceId = (deviceId != null && !deviceId.isBlank()) ? deviceId : "default-device";
        LocalDateTime expiresAt = LocalDateTime.now().plusDays(7);

        Session session = sessionRepository.findByUserIdAndDeviceId(user.getId(), safeDeviceId)
                .orElseGet(() -> Session.builder()
                        .id(UUID.randomUUID().toString())
                        .user(user)
                        .deviceId(safeDeviceId)
                        .build());

        session.setRefreshToken(refreshToken);
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
        MailQueueDto mqd = new MailQueueDto(data.email(), purpose.name(), newOtp);
        mailQueue.queueMail(mqd);
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

            // Look up session by user + device, or by refresh token
            Session session;
            if (deviceId != null && !deviceId.isBlank()) {
                session = sessionRepository.findByUserIdAndDeviceId(user.getId(), deviceId)
                        .orElseThrow(() -> new UnauthorizedException("Session not found for device"));
            } else {
                session = sessionRepository.findByRefreshToken(refreshToken)
                        .orElseThrow(() -> new UnauthorizedException("Session not found or expired"));
            }

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

package me.one_org.melody.Services.Authentication;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.redis.core.StringRedisTemplate;
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

/**
 * Login ka poora logic (OTP se, password nahi):
 *
 * 1. register / login: OTP banao, Redis me 10 minute ke liye rakho (key otp:<email>), email queue me daalo,
 *    aur tempToken (email chhupa hua signed token) lautao.
 * 2. verifyOtp: tempToken se email nikalo, OTP match karo (5 galat try = OTP khatam).
 *    Naya user ho to users table me banao. Phir access + refresh token, aur is device ka session save.
 * 3. refreshToken: refresh token session se match karo, naye tokens do ("rotation" - purana bekaar).
 *    Network glitch me app purana token dobara bheje to 7 din ki grace me maan lete hain.
 * 4. logout: access token blacklist (Redis), session hatao.
 *
 * Rate limits (IP ke hisaab se, Redis me): register 10/min, login 15/min, verify 20/min, resend 5/min,
 * aur resend ke beech 60 second cooldown.
 *
 * Service = asli business logic. Controller isko call karta hai, ye repositories (DB), Redis aur
 * bahar ki services use karta hai.
 */
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
    private final StringRedisTemplate redisTemplate;

    private static final String ROTATED_TOKEN_PREFIX = "auth:rotated:";
    private static final Duration ROTATION_GRACE_DURATION = Duration.ofDays(7);
    private final Map<String, RotatedTokenGraceEntry> localGraceCache = new ConcurrentHashMap<>();

    private record RotatedTokenGraceEntry(String sessionId, Instant expiresAt) {}

    /** Main constructor (Spring isko use karta hai). */
    @Autowired
    public AuthenticationService(UsersRepository usersRepository, SessionRepository sessionRepository,
            JwtUtil jwtUtil, HmacUtil hmacUtil, OtpUtil otpUtil,
            Redis<OtpDataDto> cache, PaginationMetaDataService paginationMetaDataService, MailQueue mailQueue,
            ApplicationEventPublisher eventPublisher,
            RateLimiterService rateLimiterService,
            TokenBlacklistService tokenBlacklistService,
            @Autowired(required = false) StringRedisTemplate redisTemplate) {
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
        this.redisTemplate = redisTemplate;
    }

    public AuthenticationService(UsersRepository usersRepository, SessionRepository sessionRepository,
            JwtUtil jwtUtil, HmacUtil hmacUtil, OtpUtil otpUtil,
            Redis<OtpDataDto> cache, PaginationMetaDataService paginationMetaDataService, MailQueue mailQueue,
            ApplicationEventPublisher eventPublisher,
            RateLimiterService rateLimiterService,
            TokenBlacklistService tokenBlacklistService) {
        this(usersRepository, sessionRepository, jwtUtil, hmacUtil, otpUtil,
             cache, paginationMetaDataService, mailQueue, eventPublisher,
             rateLimiterService, tokenBlacklistService, null);
    }

    public AuthenticationService(UsersRepository usersRepository, SessionRepository sessionRepository,
            JwtUtil jwtUtil, HmacUtil hmacUtil, OtpUtil otpUtil,
            Redis<OtpDataDto> cache, PaginationMetaDataService paginationMetaDataService, MailQueue mailQueue,
            ApplicationEventPublisher eventPublisher) {
        this(usersRepository, sessionRepository, jwtUtil, hmacUtil, otpUtil,
             cache, paginationMetaDataService, mailQueue, eventPublisher, null, null, null);
    }

    /** Register, bina IP ke (rate limit nahi lagti). */
    public String register(RegisterRequestDto request) {
        return register(request, null);
    }

    /** Naya account: email pehle se ho to 409. OTP bhejo, tempToken lautao. */
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

    /** Login, bina IP ke. */
    public String login(LoginRequestDto request) {
        return login(request, null);
    }

    /** Login: user na mile to 404. OTP bhejo, tempToken lautao. */
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

    /** Verify, bina device details ke. */
    @Transactional
    public VerifyOtpResponse verifyOtp(String tempToken, String otp, String deviceId) {
        return verifyOtp(tempToken, otp, deviceId, null, null, null);
    }

    /** Verify, bina location ke. */
    @Transactional
    public VerifyOtpResponse verifyOtp(String tempToken, String otp, String deviceId, String deviceName, String clientIp) {
        return verifyOtp(tempToken, otp, deviceId, deviceName, clientIp, null);
    }

    /**
     * OTP verify karke login karo (upar class doc ka step 2).
     * Galat OTP: "X attempts remaining" (400); 5 galat = OTP delete. Expire = 400.
     */
    @Transactional
    public VerifyOtpResponse verifyOtp(String tempToken, String otp, String deviceId, String deviceName, String clientIp, String location) {
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

        // Access token (1 ghanta) aur refresh token (7 din) banao
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
        if (location != null && !location.isBlank()) {
            session.setLocation(location);
        }
        session.setLastActiveAt(LocalDateTime.now());
        sessionRepository.save(session);

        eventPublisher.publishEvent(new me.one_org.melody.Events.TelemetryEvents.UserLoginEvent(
                user.getId(),
                user.getEmail(),
                deviceId,
                deviceName != null ? deviceName : "Unknown Device",
                clientIp != null ? clientIp : "Unknown IP",
                location != null ? location : "Unknown Location"
        ));

        return new VerifyOtpResponse(accessToken, refreshToken, isNewUser);
    }

    /** Resend, bina IP ke. */
    public String resendOtp(String tempToken) {
        return resendOtp(tempToken, null);
    }

    /**
     * Naya OTP bhejo. Pichla OTP data expire ho gaya ho par user exist kare to LOGIN maan lo.
     * 60 second ka cooldown lagta hai. Naya tempToken lautata hai.
     */
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

    /** Refresh, bina IP ke. */
    @Transactional
    public RefreshTokenResponseDto refreshToken(String refreshToken, String deviceId) {
        return refreshToken(refreshToken, deviceId, null);
    }

    /** Refresh token se naye tokens (upar class doc ka step 3). Galat / expire token = 401. */
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

            // Refresh token session wale se match hona chahiye - purana (rotated) token dobara na chale
            if (!session.getRefreshToken().equals(refreshToken)) {
                // Shayad ye token abhi abhi rotate hua tha aur app ko naya wala mila hi nahi (network drop) - 7 din ki grace me hai to maan lo
                if (isTokenInGracePeriod(refreshToken, session.getId())) {
                    log.info("Refresh token grace period hit for user [{}] device [{}]", user.getId(), deviceId);
                    CustomUserDetails userDetails = new CustomUserDetails(user);
                    Authentication auth = new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
                    String newAccessToken = jwtUtil.generateAccessToken(auth);
                    return new RefreshTokenResponseDto(newAccessToken, session.getRefreshToken());
                }

                sessionRepository.delete(session);
                throw new UnauthorizedException("Invalid or reused refresh token");
            }

            // Session expire to nahi hua?
            if (session.getExpiresAt().isBefore(LocalDateTime.now())) {
                sessionRepository.delete(session);
                throw new UnauthorizedException("Session has expired");
            }

            CustomUserDetails userDetails = new CustomUserDetails(user);
            Authentication auth = new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());

            // Naye tokens: 1 ghante ka access token aur naya 7 din ka refresh token (rotation)
            String newAccessToken = jwtUtil.generateAccessToken(auth);
            String newRefreshToken = jwtUtil.generateRefreshToken(auth);

            // Purana token 7 din grace list me rakho, taaki network glitch me retry aaye to bhi user logout na ho
            recordRotatedToken(session.getRefreshToken(), session.getId());

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

    /** Is device se logout. */
    @Transactional
    public void logout(String accessToken, String refreshToken, String deviceId) {
        logout(accessToken, refreshToken, deviceId, false);
    }

    /** Logout: access token blacklist karo, aur session(s) hatao. allDevices = true to har device se. */
    @Transactional
    public void logout(String accessToken, String refreshToken, String deviceId, boolean allDevices) {
        if (deviceId == null || deviceId.isBlank()) {
            throw new BadRequestException("Device ID is required");
        }

        // Access token turant band: uski jti Redis blacklist me daalo
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
                invalidateRotatedToken(refreshToken);
                sessionRepository.deleteByRefreshToken(refreshToken);
            }
            if (userId != null && !userId.isBlank()) {
                sessionRepository.deleteByUserIdAndDeviceId(userId, deviceId);
            }
        }
    }

    /**
     * Purane (rotate hue) refresh token ko grace list me rakho: Redis me, aur backup ke liye
     * server ki memory me bhi (Redis down ho to). Memory list 5000 se badi ho to expire hue hatao.
     */
    private void recordRotatedToken(String oldToken, String sessionId) {
        if (oldToken == null || sessionId == null) return;
        try {
            if (redisTemplate != null) {
                redisTemplate.opsForValue().set(ROTATED_TOKEN_PREFIX + oldToken, sessionId, ROTATION_GRACE_DURATION);
            }
        } catch (Exception e) {
            log.warn("Redis write failed for rotated token grace period, using local cache: {}", e.getMessage());
        }
        localGraceCache.put(oldToken, new RotatedTokenGraceEntry(sessionId, Instant.now().plus(ROTATION_GRACE_DURATION)));
        if (localGraceCache.size() > 5000) {
            Instant now = Instant.now();
            localGraceCache.entrySet().removeIf(entry -> entry.getValue().expiresAt().isBefore(now));
        }
    }

    /** Kya ye purana token isi session ka hai aur abhi grace me hai? Pehle Redis, phir memory. */
    private boolean isTokenInGracePeriod(String token, String sessionId) {
        if (token == null || sessionId == null) return false;
        try {
            if (redisTemplate != null) {
                String cachedSessionId = redisTemplate.opsForValue().get(ROTATED_TOKEN_PREFIX + token);
                if (sessionId.equals(cachedSessionId)) {
                    return true;
                }
            }
        } catch (Exception e) {
            log.warn("Redis read failed for rotated token grace period, checking local cache: {}", e.getMessage());
        }
        RotatedTokenGraceEntry entry = localGraceCache.get(token);
        return entry != null && entry.sessionId().equals(sessionId) && entry.expiresAt().isAfter(Instant.now());
    }

    /** Token ko grace list se hatao (Redis aur memory dono). */
    private void invalidateRotatedToken(String token) {
        if (token == null) return;
        try {
            if (redisTemplate != null) {
                redisTemplate.delete(ROTATED_TOKEN_PREFIX + token);
            }
        } catch (Exception ignored) {}
        localGraceCache.remove(token);
    }

    /** Website ke liye: ye access token valid hai? Blacklisted / galat / expire = logged-out. */
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

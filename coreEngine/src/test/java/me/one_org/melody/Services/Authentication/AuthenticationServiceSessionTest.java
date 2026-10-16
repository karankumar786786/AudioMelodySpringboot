package me.one_org.melody.Services.Authentication;

import java.time.LocalDateTime;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.core.Authentication;

import me.one_org.melody.Cache.Redis;
import me.one_org.melody.Dto.Controllers.Authentication.RefreshTokenResponseDto;
import me.one_org.melody.Dto.Controllers.Authentication.VerifyOtpResponse;
import me.one_org.melody.Dto.Internal.JwtPayloadDto;
import me.one_org.melody.Dto.Internal.OtpDataDto;
import me.one_org.melody.Entity.Session;
import me.one_org.melody.Entity.User;
import me.one_org.melody.Enums.PurposeEnum;
import me.one_org.melody.Enums.RoleEnum;
import me.one_org.melody.Enums.StatusEnum;
import me.one_org.melody.Exceptions.UnauthorizedException;
import me.one_org.melody.Queue.MailQueue;
import me.one_org.melody.Repository.SessionRepository;
import me.one_org.melody.Repository.UsersRepository;
import me.one_org.melody.Services.General.PaginationMetaDataService;
import me.one_org.melody.Utils.HmacUtil;
import me.one_org.melody.Utils.JwtUtil;
import me.one_org.melody.Utils.OtpUtil;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthenticationServiceSessionTest {

    @Mock
    private UsersRepository usersRepository;

    @Mock
    private SessionRepository sessionRepository;

    @Mock
    private JwtUtil jwtUtil;

    @Mock
    private HmacUtil hmacUtil;

    @Mock
    private OtpUtil otpUtil;

    @Mock
    private Redis<OtpDataDto> cache;

    @Mock
    private PaginationMetaDataService paginationMetaDataService;

    @Mock
    private MailQueue mailQueue;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    private AuthenticationService authenticationService;

    @BeforeEach
    void setUp() {
        when(cache.of(anyString(), eq(OtpDataDto.class))).thenReturn(cache);
        authenticationService = new AuthenticationService(
                usersRepository, sessionRepository, jwtUtil, hmacUtil, otpUtil,
                cache, paginationMetaDataService, mailQueue, eventPublisher
        );
    }

    @Test
    @DisplayName("Should create session with deviceId and tokens on successful OTP verification")
    void shouldCreateSessionOnVerifyOtp() {
        String tempToken = "valid-temp-token";
        String otp = "123456";
        String email = "john@example.com";
        String deviceId = "iphone-15-pro";

        when(hmacUtil.getMessageIfValid(tempToken)).thenReturn(email);
        OtpDataDto otpDto = new OtpDataDto(otp, tempToken, email, "JohnDoe", PurposeEnum.LOGIN);
        when(cache.get(email)).thenReturn(Optional.of(otpDto));

        User user = User.builder()
                .id("user-100")
                .userName("JohnDoe")
                .email(email)
                .status(StatusEnum.ACTIVE)
                .build();
        when(usersRepository.findByEmail(email)).thenReturn(Optional.of(user));
        when(jwtUtil.generateAccessToken(any(Authentication.class))).thenReturn("access-token-5min");
        when(jwtUtil.generateRefreshToken(any(Authentication.class))).thenReturn("refresh-token-7days");
        when(sessionRepository.findByUserIdAndDeviceId("user-100", deviceId)).thenReturn(Optional.empty());

        VerifyOtpResponse response = authenticationService.verifyOtp(tempToken, otp, deviceId);

        assertThat(response.accessToken()).isEqualTo("access-token-5min");
        assertThat(response.refreshToken()).isEqualTo("refresh-token-7days");
        verify(sessionRepository).save(argThat(sess ->
                sess.getUser().getId().equals("user-100") &&
                sess.getDeviceId().equals(deviceId) &&
                sess.getRefreshToken().equals("refresh-token-7days")
        ));
    }

    @Test
    @DisplayName("Should successfully reissue 5-min access token and rotated refresh token when session is valid")
    void shouldReissueTokensOnValidSession() {
        String oldRefreshToken = "rt-valid-1";
        String deviceId = "macbook-air-m3";

        JwtPayloadDto payload = new JwtPayloadDto("user-100", "JohnDoe", "john@example.com", RoleEnum.USER);
        when(jwtUtil.validateAndGetPayload(oldRefreshToken)).thenReturn(payload);

        User user = User.builder()
                .id("user-100")
                .userName("JohnDoe")
                .email("john@example.com")
                .status(StatusEnum.ACTIVE)
                .build();
        when(usersRepository.findById("user-100")).thenReturn(Optional.of(user));

        Session session = Session.builder()
                .id("sess-1")
                .user(user)
                .deviceId(deviceId)
                .refreshToken(oldRefreshToken)
                .expiresAt(LocalDateTime.now().plusDays(5))
                .build();
        when(sessionRepository.findByUserIdAndDeviceId("user-100", deviceId)).thenReturn(Optional.of(session));

        when(jwtUtil.generateAccessToken(any(Authentication.class))).thenReturn("new-access-token-5min");
        when(jwtUtil.generateRefreshToken(any(Authentication.class))).thenReturn("new-refresh-token-7days");

        RefreshTokenResponseDto response = authenticationService.refreshToken(oldRefreshToken, deviceId);

        assertThat(response.accessToken()).isEqualTo("new-access-token-5min");
        assertThat(response.refreshToken()).isEqualTo("new-refresh-token-7days");
        assertThat(session.getRefreshToken()).isEqualTo("new-refresh-token-7days");
        verify(sessionRepository).save(session);
    }

    @Test
    @DisplayName("Should reject and revoke session when old/reused refresh token is presented")
    void shouldRejectOldOrReusedRefreshToken() {
        String reusedRefreshToken = "rt-compromised-old";
        String deviceId = "macbook-air-m3";

        JwtPayloadDto payload = new JwtPayloadDto("user-100", "JohnDoe", "john@example.com", RoleEnum.USER);
        when(jwtUtil.validateAndGetPayload(reusedRefreshToken)).thenReturn(payload);

        User user = User.builder()
                .id("user-100")
                .userName("JohnDoe")
                .email("john@example.com")
                .status(StatusEnum.ACTIVE)
                .build();
        when(usersRepository.findById("user-100")).thenReturn(Optional.of(user));

        // Session was already rotated to "rt-current-rotated"
        Session session = Session.builder()
                .id("sess-1")
                .user(user)
                .deviceId(deviceId)
                .refreshToken("rt-current-rotated")
                .expiresAt(LocalDateTime.now().plusDays(5))
                .build();
        when(sessionRepository.findByUserIdAndDeviceId("user-100", deviceId)).thenReturn(Optional.of(session));

        assertThatThrownBy(() -> authenticationService.refreshToken(reusedRefreshToken, deviceId))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("Invalid or reused refresh token");

        // Verify session was revoked to mitigate token theft
        verify(sessionRepository).delete(session);
    }

    @Test
    @DisplayName("Should reject refresh request when session has expired in DB")
    void shouldRejectExpiredSession() {
        String token = "rt-expired";
        String deviceId = "device-old";

        JwtPayloadDto payload = new JwtPayloadDto("user-100", "JohnDoe", "john@example.com", RoleEnum.USER);
        when(jwtUtil.validateAndGetPayload(token)).thenReturn(payload);

        User user = User.builder()
                .id("user-100")
                .userName("JohnDoe")
                .email("john@example.com")
                .status(StatusEnum.ACTIVE)
                .build();
        when(usersRepository.findById("user-100")).thenReturn(Optional.of(user));

        Session session = Session.builder()
                .id("sess-1")
                .user(user)
                .deviceId(deviceId)
                .refreshToken(token)
                .expiresAt(LocalDateTime.now().minusHours(1)) // Expired
                .build();
        when(sessionRepository.findByUserIdAndDeviceId("user-100", deviceId)).thenReturn(Optional.of(session));

        assertThatThrownBy(() -> authenticationService.refreshToken(token, deviceId))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("Session has expired");

        verify(sessionRepository).delete(session);
    }

    @Test
    @DisplayName("Should delete session on logout to prevent infinite access from refresh token")
    void shouldDeleteSessionOnLogout() {
        String accessToken = "acc-token-123";
        String refreshToken = "rt-token-123";
        String deviceId = "device-123";

        JwtPayloadDto payload = new JwtPayloadDto("user-100", "JohnDoe", "john@example.com", RoleEnum.USER);
        when(jwtUtil.validateAndGetPayload(accessToken)).thenReturn(payload);

        authenticationService.logout(accessToken, refreshToken, deviceId);

        verify(sessionRepository).deleteByRefreshToken(refreshToken);
        verify(sessionRepository).deleteByUserIdAndDeviceId("user-100", deviceId);
    }
}

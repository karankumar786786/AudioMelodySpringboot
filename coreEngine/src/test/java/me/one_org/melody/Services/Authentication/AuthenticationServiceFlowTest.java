package me.one_org.melody.Services.Authentication;

import java.time.Duration;
import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.core.Authentication;

import me.one_org.melody.Cache.Redis;
import me.one_org.melody.Dto.Controllers.Authentication.LoginRequestDto;
import me.one_org.melody.Dto.Controllers.Authentication.RegisterRequestDto;
import me.one_org.melody.Dto.Controllers.Authentication.VerifyOtpResponse;
import me.one_org.melody.Dto.Internal.OtpDataDto;
import me.one_org.melody.Entity.Session;
import me.one_org.melody.Entity.User;
import me.one_org.melody.Enums.PurposeEnum;
import me.one_org.melody.Exceptions.BadRequestException;
import me.one_org.melody.Exceptions.ConflictException;
import me.one_org.melody.Exceptions.ResourceNotFoundException;
import me.one_org.melody.Queue.MailQueue;
import me.one_org.melody.Repository.SessionRepository;
import me.one_org.melody.Repository.UsersRepository;
import me.one_org.melody.Services.General.PaginationMetaDataService;
import me.one_org.melody.Utils.HmacUtil;
import me.one_org.melody.Utils.JwtUtil;
import me.one_org.melody.Utils.OtpUtil;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthenticationServiceFlowTest {

    @Mock
    private UsersRepository usersRepository;
    @Mock
    private SessionRepository sessionRepository;
    @Mock
    private HmacUtil hmacUtil;
    @Mock
    private OtpUtil otpUtil;
    @Mock
    private Redis cache;
    @Mock
    private JwtUtil jwtUtil;
    @Mock
    private PaginationMetaDataService paginationMetaDataService;
    @Mock
    private MailQueue mailQueue;
    @Mock
    private ApplicationEventPublisher eventPublisher;

    private AuthenticationService authenticationService;

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        when(cache.of(anyString(), any())).thenReturn(cache);
        authenticationService = new AuthenticationService(
                usersRepository, sessionRepository, jwtUtil, hmacUtil, otpUtil,
                cache, paginationMetaDataService, mailQueue, eventPublisher
        );
    }

    @Test
    @DisplayName("Should successfully register a new user and return tempToken")
    void shouldRegisterNewUser() {
        RegisterRequestDto request = new RegisterRequestDto("alice", "alice@melody.com");
        when(usersRepository.existsByEmail("alice@melody.com")).thenReturn(false);
        when(hmacUtil.hash("alice@melody.com")).thenReturn("hash-token-1");
        when(otpUtil.generateOtp()).thenReturn("123456");

        String tempToken = authenticationService.register(request);

        assertThat(tempToken).isEqualTo("hash-token-1");
        verify(cache).set(eq("alice@melody.com"), any(OtpDataDto.class), eq(Duration.ofMinutes(10)));
        verify(mailQueue).queueMail(any());
    }

    @Test
    @DisplayName("Should reject registration when email already exists")
    void shouldRejectDuplicateEmailRegistration() {
        RegisterRequestDto request = new RegisterRequestDto("alice", "alice@melody.com");
        when(usersRepository.existsByEmail("alice@melody.com")).thenReturn(true);

        assertThatThrownBy(() -> authenticationService.register(request))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("Email already in use");
    }

    @Test
    @DisplayName("Should login existing user and return tempToken")
    void shouldLoginExistingUser() {
        LoginRequestDto request = new LoginRequestDto("bob@melody.com");
        User user = User.builder().id("u-bob").userName("bob").email("bob@melody.com").build();
        when(usersRepository.findByEmail("bob@melody.com")).thenReturn(Optional.of(user));
        when(hmacUtil.hash("bob@melody.com")).thenReturn("hash-token-bob");
        when(otpUtil.generateOtp()).thenReturn("654321");

        String tempToken = authenticationService.login(request);

        assertThat(tempToken).isEqualTo("hash-token-bob");
        verify(cache).set(eq("bob@melody.com"), any(OtpDataDto.class), eq(Duration.ofMinutes(10)));
        verify(mailQueue).queueMail(any());
    }

    @Test
    @DisplayName("Should fail login if user does not exist")
    void shouldFailLoginForNonExistentUser() {
        LoginRequestDto request = new LoginRequestDto("ghost@melody.com");
        when(usersRepository.findByEmail("ghost@melody.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authenticationService.login(request))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("User not found");
    }

    @Test
    @DisplayName("Should reject verifyOtp when token is invalid or expired")
    void shouldRejectVerifyOtpOnInvalidToken() {
        when(hmacUtil.getMessageIfValid("invalid-temp-token")).thenReturn(null);

        assertThatThrownBy(() -> authenticationService.verifyOtp("invalid-temp-token", "123456", "device-1"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Token validation failed");
    }

    @Test
    @DisplayName("Should reject verifyOtp when OTP is expired in cache")
    void shouldRejectVerifyOtpOnExpiredOtp() {
        when(hmacUtil.getMessageIfValid("valid-temp")).thenReturn("user@melody.com");
        when(cache.get("user@melody.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authenticationService.verifyOtp("valid-temp", "123456", "device-1"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("OTP has expired");
    }

    @Test
    @DisplayName("Should reject verifyOtp when OTP does not match")
    void shouldRejectVerifyOtpOnMismatchedOtp() {
        when(hmacUtil.getMessageIfValid("valid-temp")).thenReturn("user@melody.com");
        OtpDataDto otpData = new OtpDataDto("654321", "valid-temp", "user@melody.com", "user", PurposeEnum.LOGIN);
        when(cache.get("user@melody.com")).thenReturn(Optional.of(otpData));

        assertThatThrownBy(() -> authenticationService.verifyOtp("valid-temp", "111111", "device-1"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Invalid OTP");
    }

    @Test
    @DisplayName("Should verifyOtp successfully for new user, create User, and issue tokens")
    void shouldVerifyOtpForNewUser() {
        when(hmacUtil.getMessageIfValid("valid-temp")).thenReturn("newbie@melody.com");
        OtpDataDto otpData = new OtpDataDto("123456", "valid-temp", "newbie@melody.com", "newbie", PurposeEnum.REGISTER);
        when(cache.get("newbie@melody.com")).thenReturn(Optional.of(otpData));
        when(usersRepository.findByEmail("newbie@melody.com")).thenReturn(Optional.empty());
        when(sessionRepository.findByUserIdAndDeviceId(any(), eq("dev-1"))).thenReturn(Optional.empty());
        when(jwtUtil.generateAccessToken(any(Authentication.class))).thenReturn("access-jwt");
        when(jwtUtil.generateRefreshToken(any(Authentication.class))).thenReturn("refresh-jwt");

        VerifyOtpResponse response = authenticationService.verifyOtp("valid-temp", "123456", "dev-1");

        assertThat(response.isNewUser()).isTrue();
        assertThat(response.accessToken()).isEqualTo("access-jwt");
        assertThat(response.refreshToken()).isEqualTo("refresh-jwt");
        verify(usersRepository).save(any(User.class));
        verify(sessionRepository).save(any(Session.class));
        verify(eventPublisher).publishEvent(any(Object.class));
        verify(cache).delete("newbie@melody.com");
    }
}

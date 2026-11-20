package me.one_org.melody.Integration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import me.one_org.melody.Controllers.Authentication.AuthenticationController;
import me.one_org.melody.Dto.Controllers.Authentication.LoginRequestDto;
import me.one_org.melody.Dto.Controllers.Authentication.RefreshTokenResponseDto;
import me.one_org.melody.Dto.Controllers.Authentication.RegisterRequestDto;
import me.one_org.melody.Dto.Controllers.Authentication.VerifyOtpResponse;
import me.one_org.melody.Security.AuthCookies;
import me.one_org.melody.Security.ClientInfoArgumentResolver;
import me.one_org.melody.Services.Authentication.AuthenticationService;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.hamcrest.Matchers.*;
import jakarta.servlet.http.Cookie;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class AuthenticationControllerIntegrationTest {

    private MockMvc mockMvc;

    @Mock
    private AuthenticationService authenticationService;

    private final AuthCookies authCookies = new AuthCookies("", true, "Lax", 3600, 604800);

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new AuthenticationController(authenticationService, authCookies))
                .setCustomArgumentResolvers(new ClientInfoArgumentResolver())
                .build();
    }

    @Test
    @DisplayName("POST /auth/register should return 201 Created and tempToken with cooldown/expiry")
    void shouldRegisterUser() throws Exception {
        when(authenticationService.register(any(RegisterRequestDto.class), any())).thenReturn("temp-token-reg");

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userName\":\"john_doe\",\"email\":\"john@example.com\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.tempToken").value("temp-token-reg"))
                .andExpect(jsonPath("$.expiresInSeconds").value(600))
                .andExpect(jsonPath("$.cooldownSeconds").value(60));
    }

    @Test
    @DisplayName("POST /auth/login should return 200 OK and tempToken with cooldown/expiry")
    void shouldLoginUser() throws Exception {
        when(authenticationService.login(any(LoginRequestDto.class), any())).thenReturn("temp-token-login");

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"john@example.com\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tempToken").value("temp-token-login"))
                .andExpect(jsonPath("$.expiresInSeconds").value(600))
                .andExpect(jsonPath("$.cooldownSeconds").value(60));
    }

    @Test
    @DisplayName("POST /auth/verify-otp should return 200 OK and tokens with body parameters")
    void shouldVerifyOtp() throws Exception {
        VerifyOtpResponse response = new VerifyOtpResponse("access-token-123", "refresh-token-456", false);
        when(authenticationService.verifyOtp(eq("temp-token-valid"), eq("123456"), eq("device-ios-1"), any(), any(), any()))
                .thenReturn(response);

        mockMvc.perform(post("/auth/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tempToken\":\"temp-token-valid\",\"otp\":\"123456\",\"deviceId\":\"device-ios-1\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("access-token-123"))
                .andExpect(jsonPath("$.refreshToken").value("refresh-token-456"))
                .andExpect(jsonPath("$.isNewUser").value(false));
    }

    @Test
    @DisplayName("POST /auth/resend-otp should return 200 OK with body tempToken")
    void shouldResendOtp() throws Exception {
        when(authenticationService.resendOtp(eq("temp-token-old"), any())).thenReturn("temp-token-new");

        mockMvc.perform(post("/auth/resend-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tempToken\":\"temp-token-old\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tempToken").value("temp-token-new"));
    }

    @Test
    @DisplayName("POST /auth/refresh-token should return 200 OK and reissued tokens")
    void shouldRefreshToken() throws Exception {
        RefreshTokenResponseDto response = new RefreshTokenResponseDto("new-access-token", "new-refresh-token");
        when(authenticationService.refreshToken(eq("existing-refresh-token"), eq("device-mac-2"), any()))
                .thenReturn(response);

        mockMvc.perform(post("/auth/refresh-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"existing-refresh-token\",\"deviceId\":\"device-mac-2\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("new-access-token"))
                .andExpect(jsonPath("$.refreshToken").value("new-refresh-token"));
    }

    @Test
    @DisplayName("Web verify-otp sets HttpOnly cookies and omits tokens from the body")
    void webVerifyOtpSetsCookies() throws Exception {
        when(authenticationService.verifyOtp(eq("temp"), eq("123456"), eq("web-device"), any(), any(), any()))
                .thenReturn(new VerifyOtpResponse("access-token-123", "refresh-token-456", true));

        mockMvc.perform(post("/auth/verify-otp")
                        .header(AuthCookies.CLIENT_HEADER, AuthCookies.WEB_CLIENT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tempToken\":\"temp\",\"otp\":\"123456\",\"deviceId\":\"web-device\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").doesNotExist())
                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andExpect(jsonPath("$.isNewUser").value(true))
                .andExpect(header().stringValues("Set-Cookie", hasItems(
                        allOf(startsWith("melody_access=access-token-123"), containsString("HttpOnly"), containsString("Secure"), containsString("Path=/;")),
                        allOf(startsWith("melody_refresh=refresh-token-456"), containsString("HttpOnly"), containsString("Path=/auth")))));
    }

    @Test
    @DisplayName("Web refresh-token reads the refresh cookie and rotates both cookies")
    void webRefreshUsesCookie() throws Exception {
        when(authenticationService.refreshToken(eq("cookie-refresh"), eq("web-device"), any()))
                .thenReturn(new RefreshTokenResponseDto("new-access", "new-refresh"));

        mockMvc.perform(post("/auth/refresh-token")
                        .header(AuthCookies.CLIENT_HEADER, AuthCookies.WEB_CLIENT)
                        .cookie(new Cookie(AuthCookies.REFRESH_COOKIE, "cookie-refresh"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"deviceId\":\"web-device\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").doesNotExist())
                .andExpect(header().stringValues("Set-Cookie", hasItems(
                        startsWith("melody_access=new-access"), startsWith("melody_refresh=new-refresh"))));
    }

    @Test
    @DisplayName("Refresh cookie is ignored without the web client header")
    void refreshCookieIgnoredWithoutWebHeader() throws Exception {
        mockMvc.perform(post("/auth/refresh-token")
                        .cookie(new Cookie(AuthCookies.REFRESH_COOKIE, "cookie-refresh"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"deviceId\":\"dev\"}"))
                .andExpect(header().doesNotExist("Set-Cookie"));
        verify(authenticationService).refreshToken(org.mockito.ArgumentMatchers.isNull(), eq("dev"), any());
    }

    @Test
    @DisplayName("Web logout revokes the cookie session and clears both cookies")
    void webLogoutClearsCookies() throws Exception {
        mockMvc.perform(post("/auth/logout")
                        .header(AuthCookies.CLIENT_HEADER, AuthCookies.WEB_CLIENT)
                        .cookie(new Cookie(AuthCookies.ACCESS_COOKIE, "acc"), new Cookie(AuthCookies.REFRESH_COOKIE, "ref"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"deviceId\":\"web-device\"}"))
                .andExpect(status().isNoContent())
                .andExpect(header().stringValues("Set-Cookie", hasItems(
                        allOf(startsWith("melody_access=;"), containsString("Max-Age=0")),
                        allOf(startsWith("melody_refresh=;"), containsString("Max-Age=0")))));
        verify(authenticationService).logout("acc", "ref", "web-device", false);
    }
}

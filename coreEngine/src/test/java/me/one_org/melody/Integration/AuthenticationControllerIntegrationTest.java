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
import me.one_org.melody.Services.Authentication.AuthenticationService;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class AuthenticationControllerIntegrationTest {

    private MockMvc mockMvc;

    @Mock
    private AuthenticationService authenticationService;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new AuthenticationController(authenticationService)).build();
    }

    @Test
    @DisplayName("POST /auth/register should return 201 Created and tempToken")
    void shouldRegisterUser() throws Exception {
        when(authenticationService.register(any(RegisterRequestDto.class))).thenReturn("temp-token-reg");

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userName\":\"john_doe\",\"email\":\"john@example.com\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.tempToken").value("temp-token-reg"));
    }

    @Test
    @DisplayName("POST /auth/login should return 200 OK and tempToken")
    void shouldLoginUser() throws Exception {
        when(authenticationService.login(any(LoginRequestDto.class))).thenReturn("temp-token-login");

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"john@example.com\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tempToken").value("temp-token-login"));
    }

    @Test
    @DisplayName("POST /auth/verify-otp should return 200 OK and tokens with body parameters")
    void shouldVerifyOtp() throws Exception {
        VerifyOtpResponse response = new VerifyOtpResponse("access-token-123", "refresh-token-456", false);
        when(authenticationService.verifyOtp(eq("temp-token-valid"), eq("123456"), eq("device-ios-1")))
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
        when(authenticationService.resendOtp(eq("temp-token-old"))).thenReturn("temp-token-new");

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
        when(authenticationService.refreshToken(eq("existing-refresh-token"), eq("device-mac-2")))
                .thenReturn(response);

        mockMvc.perform(post("/auth/refresh-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"existing-refresh-token\",\"deviceId\":\"device-mac-2\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("new-access-token"))
                .andExpect(jsonPath("$.refreshToken").value("new-refresh-token"));
    }

    @Test
    @DisplayName("POST /auth/logout should return 200 OK and success message")
    void shouldLogout() throws Exception {
        mockMvc.perform(post("/auth/logout")
                        .header("Authorization", "Bearer access-token-xyz")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"refresh-token-xyz\",\"deviceId\":\"device-mac-2\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Logged out successfully"));

        verify(authenticationService).logout("access-token-xyz", "refresh-token-xyz", "device-mac-2");
    }
}

package me.one_org.melody.Dto.Controllers.Authentication;

import jakarta.validation.constraints.NotBlank;

/**
 * OTP sahi tha: access + refresh token. isNewUser = true ho to app onboarding dikhata hai.
 */
public record VerifyOtpResponse(
    @NotBlank
    String accessToken,
    @NotBlank
    String refreshToken,
    Boolean isNewUser
) {
    public VerifyOtpResponse(String accessToken, String refreshToken) {
        this(accessToken, refreshToken, false);
    }
}

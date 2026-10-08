package me.one_org.melody.Dto.Controllers.Authentication;

import jakarta.validation.constraints.NotBlank;

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

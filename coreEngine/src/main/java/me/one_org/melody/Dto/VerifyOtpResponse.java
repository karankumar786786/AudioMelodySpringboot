package me.one_org.melody.Dto;

import jakarta.validation.constraints.NotBlank;

public record VerifyOtpResponse(
    @NotBlank
    String accessToken,
    @NotBlank
    String refreshToken
) {
}

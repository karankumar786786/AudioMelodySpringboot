package me.one_org.melody.Dto.Controllers.Authentication;

import jakarta.validation.constraints.NotBlank;

public record RefreshTokenRequestDto(
    String refreshToken,
    @NotBlank(message = "Device ID is required")
    String deviceId
) {
    public RefreshTokenRequestDto(String refreshToken) {
        this(refreshToken, null);
    }
}

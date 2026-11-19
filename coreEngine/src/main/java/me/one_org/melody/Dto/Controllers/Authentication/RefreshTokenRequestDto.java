package me.one_org.melody.Dto.Controllers.Authentication;

import jakarta.validation.constraints.NotBlank;

public record RefreshTokenRequestDto(
    /** Required for bearer clients (mobile); the web app sends it as an HttpOnly cookie instead. */
    String refreshToken,
    @NotBlank(message = "Device ID is required")
    String deviceId
) {
    public RefreshTokenRequestDto {
        refreshToken = refreshToken != null ? refreshToken.trim() : null;
        deviceId = deviceId != null ? deviceId.trim() : null;
    }
}

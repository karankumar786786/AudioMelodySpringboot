package me.one_org.melody.Dto.Controllers.Authentication;

import jakarta.validation.constraints.NotBlank;

/**
 * Naya access token maangne ki request.
 */
public record RefreshTokenRequestDto(
    /** Mobile app ke liye zaroori; website ise HttpOnly cookie me bhejti hai, body me nahi. */
    String refreshToken,
    @NotBlank(message = "Device ID is required")
    String deviceId
) {
    public RefreshTokenRequestDto {
        refreshToken = refreshToken != null ? refreshToken.trim() : null;
        deviceId = deviceId != null ? deviceId.trim() : null;
    }
}

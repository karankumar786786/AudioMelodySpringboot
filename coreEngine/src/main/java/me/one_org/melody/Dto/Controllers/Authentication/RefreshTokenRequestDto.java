package me.one_org.melody.Dto.Controllers.Authentication;

import jakarta.validation.constraints.NotBlank;

public record RefreshTokenRequestDto(
    @NotBlank
    String refreshToken,
    String deviceId
) {
    public RefreshTokenRequestDto(String refreshToken) {
        this(refreshToken, null);
    }
}

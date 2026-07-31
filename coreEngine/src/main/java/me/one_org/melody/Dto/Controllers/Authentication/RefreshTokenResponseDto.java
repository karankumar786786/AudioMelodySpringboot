package me.one_org.melody.Dto.Controllers.Authentication;

import jakarta.validation.constraints.NotBlank;

public record RefreshTokenResponseDto(
    @NotBlank
    String accessToken,
    @NotBlank
    String refreshToken
) {
}

package me.one_org.melody.Dto.Controllers.Authentication;

import jakarta.validation.constraints.NotBlank;

/**
 * Refresh ka jawab: naya access token aur naya refresh token (purana ab kaam nahi karega).
 */
public record RefreshTokenResponseDto(
    @NotBlank
    String accessToken,
    @NotBlank
    String refreshToken
) {
}

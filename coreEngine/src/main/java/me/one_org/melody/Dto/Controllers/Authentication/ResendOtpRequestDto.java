package me.one_org.melody.Dto.Controllers.Authentication;

import jakarta.validation.constraints.NotBlank;

/**
 * Dobara OTP bhejo - tempToken se pata chalta hai kis email pe.
 */
public record ResendOtpRequestDto(
    @NotBlank(message = "Verification token is required")
    String tempToken
) {
    public ResendOtpRequestDto {
        tempToken = tempToken != null ? tempToken.trim() : null;
    }
}

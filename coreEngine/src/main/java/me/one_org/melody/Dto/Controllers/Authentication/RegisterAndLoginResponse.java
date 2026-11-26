package me.one_org.melody.Dto.Controllers.Authentication;

import jakarta.validation.constraints.NotBlank;

/**
 * Register/login ka jawab: tempToken, jo OTP verify karte waqt wapas bhejna hai.
 */
public record RegisterAndLoginResponse(
    @NotBlank
    String tempToken
) {
}

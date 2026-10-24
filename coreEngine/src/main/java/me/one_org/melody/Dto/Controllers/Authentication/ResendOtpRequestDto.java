package me.one_org.melody.Dto.Controllers.Authentication;

import jakarta.validation.constraints.NotBlank;

public record ResendOtpRequestDto(
    @NotBlank
    String tempToken
) {
}

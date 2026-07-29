package me.one_org.melody.Dto;

import jakarta.validation.constraints.NotBlank;

public record VerifyOtpRequest(
    @NotBlank
    String otp
) {
}

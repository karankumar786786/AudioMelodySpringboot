package me.one_org.melody.Dto.Controllers.Authentication;

import jakarta.validation.constraints.NotBlank;

public record VerifyOtpRequest(
    @NotBlank
    String otp,
    String deviceId
) {
    public VerifyOtpRequest(String otp) {
        this(otp, null);
    }
}

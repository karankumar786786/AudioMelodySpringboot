package me.one_org.melody.Dto.Controllers.Authentication;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record VerifyOtpRequest(
    @NotBlank(message = "Verification token is required")
    String tempToken,
    @NotBlank(message = "OTP is required")
    @Pattern(regexp = "^\\d{6}$", message = "OTP must be exactly 6 digits")
    String otp,
    @NotBlank(message = "Device ID is required")
    String deviceId
) {
    public VerifyOtpRequest {
        tempToken = tempToken != null ? tempToken.trim() : null;
        otp = otp != null ? otp.trim() : null;
        deviceId = deviceId != null ? deviceId.trim() : null;
    }
}

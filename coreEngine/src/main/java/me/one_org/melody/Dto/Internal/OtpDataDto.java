package me.one_org.melody.Dto.Internal;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import me.one_org.melody.Enums.PurposeEnum;

/**
 * Redis me OTP ke saath rakha data: OTP, tempToken, email, naam, kis kaam ka OTP (Purpose),
 * aur kitni baar galat OTP daala (attempts) - zyada galat try pe OTP band ho jaata hai.
 */
public record OtpDataDto(
        @NotBlank String otp,
        @NotNull String tempToken,
        @NotNull @Email String email,
        @NotNull String userName,
        @NotNull PurposeEnum Purpose,
        int attempts
) {
    public OtpDataDto(String otp, String tempToken, String email, String userName, PurposeEnum Purpose) {
        this(otp, tempToken, email, userName, Purpose, 0);
    }
}

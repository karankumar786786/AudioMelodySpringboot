package me.one_org.melody.Dto.Internal;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;


public record OtpDataDto(
        @NotBlank String otp,
        @NotNull String tempToken,
        @NotNull @Email String email,
        @NotNull String userName
) {}

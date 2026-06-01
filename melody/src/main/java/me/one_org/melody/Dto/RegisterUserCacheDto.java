package me.one_org.melody.Dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record RegisterUserCacheDto(
        @NotBlank String otp,
        @NotNull RegisterRequestDto registerRequest)  {
}

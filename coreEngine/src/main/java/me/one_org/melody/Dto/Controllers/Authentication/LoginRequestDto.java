package me.one_org.melody.Dto.Controllers.Authentication;

import java.util.Locale;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record LoginRequestDto(
    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    String email
) {
    public LoginRequestDto {
        email = email != null ? email.trim().toLowerCase(Locale.ROOT) : null;
    }
}

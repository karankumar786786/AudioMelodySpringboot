package me.one_org.melody.Dto.Controllers.Authentication;

import java.util.Locale;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record RegisterRequestDto(
    @NotBlank(message = "Username is required")
    @Pattern(regexp = "^[a-zA-Z0-9_.-]{3,30}$", message = "Username must be 3-30 characters and contain only letters, numbers, underscores, dashes, or dots")
    String userName,
    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    String email
) {
    public RegisterRequestDto {
        userName = userName != null ? userName.trim() : null;
        email = email != null ? email.trim().toLowerCase(Locale.ROOT) : null;
    }
}

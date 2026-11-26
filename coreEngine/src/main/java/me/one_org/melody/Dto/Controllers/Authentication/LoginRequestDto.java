package me.one_org.melody.Dto.Controllers.Authentication;

import java.util.Locale;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Login request: sirf email (OTP isi pe jaayega). Email ko trim + lowercase kar dete hain.
 */
public record LoginRequestDto(
    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    String email
) {
    public LoginRequestDto {
        email = email != null ? email.trim().toLowerCase(Locale.ROOT) : null;
    }
}

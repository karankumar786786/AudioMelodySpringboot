package me.one_org.melody.Dto.Controllers.Authentication;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record RegisterRequestDto(
    @NotBlank(message = "Username is required")
    String userName,
    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    String email
) {
}

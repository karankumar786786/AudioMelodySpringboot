package me.one_org.melody.Dto.Controllers.Authentication;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record LoginRequestDto(
    @NotBlank
    @Email
    String email
) {
}

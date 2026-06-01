package me.one_org.melody.Dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record RegisterRequestDto(
    @NotBlank
    String userName,
    @Email
    String email
) {
    
}

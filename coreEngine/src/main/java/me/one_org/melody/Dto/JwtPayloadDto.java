package me.one_org.melody.Dto;

import jakarta.validation.constraints.NotBlank;
import me.one_org.melody.Enums.Role;

public record JwtPayloadDto(
    @NotBlank
    String id,
    @NotBlank
    String userName,
    @NotBlank
    String email,
    @NotBlank
    Role role
) {}

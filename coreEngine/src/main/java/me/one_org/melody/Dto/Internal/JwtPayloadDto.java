package me.one_org.melody.Dto.Internal;

import jakarta.validation.constraints.NotBlank;
import me.one_org.melody.Enums.RoleEnum;

public record JwtPayloadDto(
    @NotBlank
    String id,
    @NotBlank
    String userName,
    @NotBlank
    String email,
    @NotBlank
    RoleEnum role
) {}

package me.one_org.melody.Dto.Internal;

import jakarta.validation.constraints.NotBlank;
import me.one_org.melody.Enums.RoleEnum;

/**
 * JWT token ke andar rakha user data: id, naam, email, role.
 */
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

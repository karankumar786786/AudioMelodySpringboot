package me.one_org.melody.Dto.Controllers.Authentication;

import jakarta.validation.constraints.NotBlank;

public record RegisterAndLoginResponse(
    @NotBlank
    String tempToken
) {
}

package me.one_org.melody.Dto.Controllers.Api;

import jakarta.validation.constraints.NotBlank;

public record CreateUserPlaylistRequestDto(
    @NotBlank String name
) {
}

package me.one_org.melody.Dto.Controllers.Admin;

import jakarta.validation.constraints.NotBlank;

public record CreatePlaylistRequestDto(
    @NotBlank String name,
    String description,
    @NotBlank String coverImageKey,
    String videoKey
) {
}

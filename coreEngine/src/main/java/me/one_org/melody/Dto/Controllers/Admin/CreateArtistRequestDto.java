package me.one_org.melody.Dto.Controllers.Admin;

import jakarta.validation.constraints.NotBlank;

public record CreateArtistRequestDto(
    @NotBlank String name,
    String about,
    String coverImageKey
) {
}

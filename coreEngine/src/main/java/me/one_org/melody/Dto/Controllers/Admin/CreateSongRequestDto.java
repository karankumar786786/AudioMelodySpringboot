package me.one_org.melody.Dto.Controllers.Admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateSongRequestDto(
    @NotBlank String title,
    @NotBlank String artistName,
    @NotNull Integer duration,
    @NotBlank String tempSongKey,
    @NotBlank String imageKey,
    String language
) {
}

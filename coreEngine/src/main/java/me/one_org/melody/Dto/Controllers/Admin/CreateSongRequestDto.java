package me.one_org.melody.Dto.Controllers.Admin;

import jakarta.validation.constraints.NotBlank;


public record CreateSongRequestDto(
    @NotBlank String title,
    @NotBlank String artistName,
    @NotBlank String tempSongKey,
    @NotBlank String imageKey,
    String videoKey,
    @NotBlank
    String language,
    @NotBlank
    String lrclibId
) {
}

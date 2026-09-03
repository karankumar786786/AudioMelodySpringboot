package me.one_org.melody.Dto.Controllers.Admin;

import jakarta.validation.constraints.NotBlank;


public record CreateSongRequestDto(
    @NotBlank String title,
    @NotBlank String artistName,
    String tempSongKey,
    String tempVideoKey,
    @NotBlank String imageKey,
    String videoKey,
    Integer clipStartMin,
    Integer clipStartSec,
    Integer clipEndMin,
    Integer clipEndSec,
    @NotBlank
    String language,
    @NotBlank
    String lrclibId
) {
}

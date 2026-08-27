package me.one_org.melody.Dto.Controllers.Admin;

public record UpdateSongRequestDto(
    String title,
    String artistName,
    String imageKey,
    String videoKey,
    String language,
    String lrclibId
) {
}

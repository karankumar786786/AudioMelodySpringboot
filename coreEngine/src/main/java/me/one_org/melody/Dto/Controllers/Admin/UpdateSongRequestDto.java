package me.one_org.melody.Dto.Controllers.Admin;

public record UpdateSongRequestDto(
    String title,
    String artistName,
    String imageKey,
    String videoKey,
    String fullVideoKey,
    String language,
    String genre,
    String lrclibId,
    Boolean isFeatured,
    Integer previewStartTime,
    Integer previewEndTime
) {
}

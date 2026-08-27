package me.one_org.melody.Dto.Controllers.Admin;

public record UpdateArtistRequestDto(
    String name,
    String about,
    String coverImageKey
) {
}

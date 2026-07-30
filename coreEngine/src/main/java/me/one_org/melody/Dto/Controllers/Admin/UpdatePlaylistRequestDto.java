package me.one_org.melody.Dto.Controllers.Admin;

public record UpdatePlaylistRequestDto(
    String name,
    String description,
    String coverImageKey,
    String bannerImageKey
) {
}

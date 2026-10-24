package me.one_org.melody.Dto.Controllers.Api;

import jakarta.validation.constraints.NotBlank;

public record SaveSearchHistoryRequestDto(
    @NotBlank(message = "Search history type is required")
    String type, // "SONG", "ARTIST", "PLAYLIST", "USER_PLAYLIST"
    String songId,
    String artistId,
    String playlistId,
    String userPlaylistId
) {}

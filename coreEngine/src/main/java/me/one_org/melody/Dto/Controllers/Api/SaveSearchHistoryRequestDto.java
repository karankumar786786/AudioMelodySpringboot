package me.one_org.melody.Dto.Controllers.Api;

public record SaveSearchHistoryRequestDto(
    String type, // "SONG", "ARTIST", "PLAYLIST", "USER_PLAYLIST"
    String songId,
    String artistId,
    String playlistId,
    String userPlaylistId
) {}

package me.one_org.melody.Dto.Controllers.Api;

import java.time.LocalDateTime;

public record UserSearchHistoryItemDto(
    String id,
    String type, // "SONG", "ARTIST", "PLAYLIST", "USER_PLAYLIST"
    SongDto song,
    ArtistDto artist,
    PlaylistDto playlist,
    UserPlaylistDto userPlaylist,
    LocalDateTime createdAt
) {}

package me.one_org.melody.Dto.Controllers.Api;

import java.time.LocalDateTime;

import me.one_org.melody.Entity.ArtistsEntity;
import me.one_org.melody.Entity.PlaylistsEntity;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Entity.UserPlaylistsEntity;

public record UserSearchHistoryItemDto(
    String id,
    String type, // "SONG", "ARTIST", "PLAYLIST", "USER_PLAYLIST"
    SongsEntity song,
    ArtistsEntity artist,
    PlaylistsEntity playlist,
    UserPlaylistsEntity userPlaylist,
    LocalDateTime createdAt
) {}

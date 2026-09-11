package me.one_org.melody.Dto.Controllers.Api;

import java.util.List;

import me.one_org.melody.Entity.ArtistsEntity;
import me.one_org.melody.Entity.PlaylistsEntity;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Entity.UserPlaylistsEntity;

public record UserSearchHistoryGroupedResponseDto(
    List<UserSearchHistoryItemDto> recent,
    List<SongsEntity> songs,
    List<ArtistsEntity> artists,
    List<PlaylistsEntity> playlists,
    List<UserPlaylistsEntity> userPlaylists
) {}

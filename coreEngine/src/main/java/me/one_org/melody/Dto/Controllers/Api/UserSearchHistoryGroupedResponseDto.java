package me.one_org.melody.Dto.Controllers.Api;

import java.util.List;

public record UserSearchHistoryGroupedResponseDto(
    List<UserSearchHistoryItemDto> recent,
    List<SongDto> songs,
    List<ArtistDto> artists,
    List<PlaylistDto> playlists,
    List<UserPlaylistDto> userPlaylists
) {}

package me.one_org.melody.Dto.Controllers.Api;

import java.util.List;

/**
 * Recent searches screen: sab mila ke (recent) aur type ke hisaab se alag alag lists.
 */
public record UserSearchHistoryGroupedResponseDto(
    List<UserSearchHistoryItemDto> recent,
    List<SongDto> songs,
    List<ArtistDto> artists,
    List<PlaylistDto> playlists,
    List<UserPlaylistDto> userPlaylists
) {}

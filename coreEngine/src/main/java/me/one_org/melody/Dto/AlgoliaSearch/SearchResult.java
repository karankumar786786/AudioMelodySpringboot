package me.one_org.melody.Dto.AlgoliaSearch;

import java.util.List;

import me.one_org.melody.Dto.Controllers.Api.ArtistDto;
import me.one_org.melody.Dto.Controllers.Api.PlaylistDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Dto.Controllers.Api.UserPlaylistDto;

/**
 * Final search result after fetching full data from DB.
 * Algolia returns IDs -> DB fetch -> this DTO is returned to the client.
 */
public record SearchResult(
    List<SongDto> songs,
    List<ArtistDto> artists,
    List<PlaylistDto> playlists,
    List<UserPlaylistDto> userPlaylists
) {
}

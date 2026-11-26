package me.one_org.melody.Dto.AlgoliaSearch;

import java.util.List;

import me.one_org.melody.Dto.Controllers.Api.ArtistDto;
import me.one_org.melody.Dto.Controllers.Api.PlaylistDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Dto.Controllers.Api.UserPlaylistDto;

/**
 * Search ka final jawab jo app ko jaata hai.
 * Flow: Algolia sirf ids deta hai -> un ids se DB se poora data laate hain -> ye DTO.
 */
public record SearchResult(
    List<SongDto> songs,
    List<ArtistDto> artists,
    List<PlaylistDto> playlists,
    List<UserPlaylistDto> userPlaylists
) {
}

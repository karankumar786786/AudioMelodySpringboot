package me.one_org.melody.Dto.AlgoliaSearch;

import java.util.List;

public record AlgoliaSearchResult(
    List<AlgoliaSearchSongDto> songs,
    List<AlgoliaSearchArtistDto> artists,
    List<AlgoliaSearchPlaylistDto> playlists
) {
    
}

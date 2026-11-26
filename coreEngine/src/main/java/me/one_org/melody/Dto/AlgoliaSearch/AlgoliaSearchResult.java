package me.one_org.melody.Dto.AlgoliaSearch;

import java.util.List;

/**
 * Algolia ka raw jawab: songs, artists, playlists ki ids ki lists.
 */
public record AlgoliaSearchResult(
    List<AlgoliaSearchSongDto> songs,
    List<AlgoliaSearchArtistDto> artists,
    List<AlgoliaSearchPlaylistDto> playlists
) {
    
}

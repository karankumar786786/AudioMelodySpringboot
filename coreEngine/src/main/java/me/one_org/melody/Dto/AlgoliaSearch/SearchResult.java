package me.one_org.melody.Dto.AlgoliaSearch;

import java.util.List;

import me.one_org.melody.Entity.ArtistsEntity;
import me.one_org.melody.Entity.PlaylistsEntity;
import me.one_org.melody.Entity.SongsEntity;

/**
 * Final search result after fetching full data from DB.
 * Algolia returns IDs → DB fetch → this DTO is returned to the client.
 */
public record SearchResult(
    List<SongsEntity> songs,
    List<ArtistsEntity> artists,
    List<PlaylistsEntity> playlists
) {
}

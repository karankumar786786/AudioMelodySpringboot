package me.one_org.melody.Dto.AlgoliaSearch;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import me.one_org.melody.Entity.ArtistsEntity;
import me.one_org.melody.Entity.PlaylistsEntity;
import me.one_org.melody.Entity.SongsEntity;

@Data
@AllArgsConstructor
public class SearchResult {
    List<SongsEntity> songs;
    List<ArtistsEntity> artists;
    List<PlaylistsEntity> playlists;
}

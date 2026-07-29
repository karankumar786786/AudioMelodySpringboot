package me.one_org.melody.Dto;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import me.one_org.melody.Entity.Artists;
import me.one_org.melody.Entity.Playlists;
import me.one_org.melody.Entity.Songs;

@Data
@AllArgsConstructor
public class SearchResult {
    List<Songs> songs;
    List<Artists> artists;
    List<Playlists> playlists;
}

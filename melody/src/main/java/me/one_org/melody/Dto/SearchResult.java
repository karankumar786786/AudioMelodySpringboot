package me.one_org.melody.Dto;

import java.util.List;

import me.one_org.melody.Entity.Artists;
import me.one_org.melody.Entity.Playlists;
import me.one_org.melody.Entity.Songs;

public class SearchResult {
    List<Songs> songs;
    List<Artists> artists;
    List<Playlists> playlists;
}

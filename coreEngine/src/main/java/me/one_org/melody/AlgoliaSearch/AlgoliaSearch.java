package me.one_org.melody.AlgoliaSearch;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.algolia.api.SearchClient;
import com.algolia.model.search.*;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Dto.AlgoliaSearch.AlgoliaSearchResult;
import me.one_org.melody.Dto.AlgoliaSearch.AlgoliaSearchSongDto;
import me.one_org.melody.Dto.AlgoliaSearch.AlgoliaSearchArtistDto;
import me.one_org.melody.Dto.AlgoliaSearch.AlgoliaSearchPlaylistDto;
import me.one_org.melody.Entity.ArtistsEntity;
import me.one_org.melody.Entity.PlaylistsEntity;
import me.one_org.melody.Entity.SongsEntity;

@Component
@Slf4j
public class AlgoliaSearch {

    private final SearchClient searchClient;

    @Value("${algolia.index-name}")
    private String indexName;

    public AlgoliaSearch(SearchClient searchClient){
        this.searchClient = searchClient;
    }

    @PostConstruct
    public void configureIndex() throws Exception {
        searchClient.setSettings(indexName, new IndexSettings().setSearchableAttributes(List.of(
                "title",
                "artistName",
                "language",
                "name")));
        log.info("Algolia index configured with searchable attributes");
    }

    // ── Save individual records ──

    public void save(SongsEntity song) throws Exception {
        Map<String, Object> record = new HashMap<>();
        record.put("objectID", song.getId());
        record.put("type", "song");
        record.put("title", song.getTitle());
        record.put("artistName", song.getArtistName());
        record.put("language", song.getLanguage());
        searchClient.saveObject(indexName, record);
    }

    public void save(ArtistsEntity artist) throws Exception {
        Map<String, Object> record = new HashMap<>();
        record.put("objectID", artist.getId());
        record.put("type", "artist");
        record.put("name", artist.getName());
        searchClient.saveObject(indexName, record);
    }

    public void save(PlaylistsEntity playlist) throws Exception {
        Map<String, Object> record = new HashMap<>();
        record.put("objectID", playlist.getId());
        record.put("type", "playlist");
        record.put("name", playlist.getName());
        searchClient.saveObject(indexName, record);
    }

    // ── Delete ──

    public void delete(String id) {
        searchClient.deleteObject(indexName, id);
    }

    // ── Search — returns IDs grouped by type, caller fetches full data from DB ──

    public AlgoliaSearchResult search(String query) {
        List<AlgoliaSearchSongDto> songs = new ArrayList<>();
        List<AlgoliaSearchArtistDto> artists = new ArrayList<>();
        List<AlgoliaSearchPlaylistDto> playlists = new ArrayList<>();

        try {
            var response = searchClient.searchSingleIndex(
                    indexName,
                    new SearchParamsObject().setQuery(query).setHitsPerPage(20),
                    Map.class);

            for (var hit : response.getHits()) {
                @SuppressWarnings("unchecked")
                Map<String, Object> h = (Map<String, Object>) hit;
                String type = (String) h.get("type");
                if (type == null) continue;
                String objectId = (String) h.get("objectID");

                switch (type) {
                    case "song" -> songs.add(new AlgoliaSearchSongDto(objectId));
                    case "artist" -> artists.add(new AlgoliaSearchArtistDto(objectId));
                    case "playlist" -> playlists.add(new AlgoliaSearchPlaylistDto(objectId));
                }
            }
        } catch (Exception e) {
            throw new RuntimeException("Algolia search failed: " + e.getMessage(), e);
        }
        return new AlgoliaSearchResult(songs, artists, playlists);
    }

    // ── Bulk resync ──

    public void reindexAllSongs(List<SongsEntity> songs) throws Exception {
        List<Map<String, Object>> records = new ArrayList<>();
        for (SongsEntity song : songs) {
            Map<String, Object> record = new HashMap<>();
            record.put("objectID", song.getId());
            record.put("type", "song");
            record.put("title", song.getTitle());
            record.put("artistName", song.getArtistName());
            record.put("language", song.getLanguage());
            records.add(record);
        }
        if (!records.isEmpty()) {
            searchClient.saveObjects(indexName, records);
        }
        log.info("Reindexed {} songs in Algolia", songs.size());
    }

    public void reindexAllArtists(List<ArtistsEntity> artists) throws Exception {
        List<Map<String, Object>> records = new ArrayList<>();
        for (ArtistsEntity artist : artists) {
            Map<String, Object> record = new HashMap<>();
            record.put("objectID", artist.getId());
            record.put("type", "artist");
            record.put("name", artist.getName());
            records.add(record);
        }
        if (!records.isEmpty()) {
            searchClient.saveObjects(indexName, records);
        }
        log.info("Reindexed {} artists in Algolia", artists.size());
    }

    public void reindexAllPlaylists(List<PlaylistsEntity> playlists) throws Exception {
        List<Map<String, Object>> records = new ArrayList<>();
        for (PlaylistsEntity playlist : playlists) {
            Map<String, Object> record = new HashMap<>();
            record.put("objectID", playlist.getId());
            record.put("type", "playlist");
            record.put("name", playlist.getName());
            records.add(record);
        }
        if (!records.isEmpty()) {
            searchClient.saveObjects(indexName, records);
        }
        log.info("Reindexed {} playlists in Algolia", playlists.size());
    }

    public void clearIndex() throws Exception {
        searchClient.clearObjects(indexName);
        log.info("Algolia index '{}' cleared", indexName);
    }
}
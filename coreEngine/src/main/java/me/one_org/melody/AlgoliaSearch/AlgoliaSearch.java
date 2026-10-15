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
import me.one_org.melody.Entity.Artist;
import me.one_org.melody.Entity.Playlist;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Entity.UserPlaylist;
import me.one_org.melody.Dto.AlgoliaSearch.AlgoliaSearchArtistDto;
import me.one_org.melody.Dto.AlgoliaSearch.AlgoliaSearchPlaylistDto;

import me.one_org.melody.Dto.AlgoliaSearch.AlgoliaClientConfigDto;

@Component
@Slf4j
public class AlgoliaSearch {

    private final SearchClient searchClient;

    @Value("${algolia.index-name}")
    private String indexName;

    @Value("${algolia.app-id}")
    private String appId;

    @Value("${algolia.api-key}")
    private String apiKey;

    @Value("${algolia.search-api-key:}")
    private String searchApiKey;

    public AlgoliaSearch(SearchClient searchClient){
        this.searchClient = searchClient;
    }

    @PostConstruct
    public void configureIndex() throws Exception {
        searchClient.setSettings(indexName, new IndexSettings()
                .setSearchableAttributes(List.of(
                        "title",
                        "artistName",
                        "album",
                        "name",
                        "language",
                        "genre"))
                .setAttributesForFaceting(List.of(
                        "filterOnly(type)",
                        "searchable(language)",
                        "searchable(genre)"))
                .setCustomRanking(List.of(
                        "desc(listenCount)",
                        "desc(searchCount)")));
        log.info("Algolia index configured with searchable attributes, facets, and customRanking desc(listenCount), desc(searchCount)");
    }

    public AlgoliaClientConfigDto getClientSearchConfig() {
        if (searchApiKey != null && !searchApiKey.isBlank()) {
            return new AlgoliaClientConfigDto(appId, indexName, searchApiKey);
        }
        try {
            SecuredApiKeyRestrictions restrictions = new SecuredApiKeyRestrictions()
                    .setRestrictIndices(List.of(indexName))
                    .setValidUntil((System.currentTimeMillis() / 1000L) + 86400L); // 24 hours validity
            String generatedKey = searchClient.generateSecuredApiKey(apiKey, restrictions);
            return new AlgoliaClientConfigDto(appId, indexName, generatedKey);
        } catch (Exception e) {
            log.warn("Failed to generate secured Algolia API key, falling back to searchApiKey: {}", e.getMessage());
            return new AlgoliaClientConfigDto(appId, indexName, searchApiKey != null ? searchApiKey : "");
        }
    }

    public void incrementSearchCount(String objectId) {
        if (objectId == null || objectId.isBlank()) return;
        try {
            Map<String, Object> operation = new HashMap<>();
            operation.put("_operation", "Increment");
            operation.put("value", 1);

            Map<String, Object> update = new HashMap<>();
            update.put("searchCount", operation);

            searchClient.partialUpdateObject(indexName, objectId, update, true);
            log.info("Incremented Algolia searchCount for object [{}]", objectId);
        } catch (Exception e) {
            log.warn("Failed to increment searchCount in Algolia for [{}]: {}", objectId, e.getMessage());
        }
    }

    public void incrementListenCount(String songId) {
        if (songId == null || songId.isBlank()) return;
        try {
            Map<String, Object> operation = new HashMap<>();
            operation.put("_operation", "Increment");
            operation.put("value", 1);

            Map<String, Object> update = new HashMap<>();
            update.put("listenCount", operation);

            searchClient.partialUpdateObject(indexName, songId, update, true);
            log.info("Incremented Algolia listenCount for song [{}]", songId);
        } catch (Exception e) {
            log.warn("Failed to increment listenCount in Algolia for [{}]: {}", songId, e.getMessage());
        }
    }

    public void save(Song song) throws Exception {
        Map<String, Object> record = new HashMap<>();
        record.put("objectID", song.getId());
        record.put("type", "song");
        record.put("title", song.getTitle());
        record.put("artistName", song.getArtistName());
        record.put("album", song.getAlbum());
        record.put("language", song.getLanguage());
        if (song.getGenre() != null && !song.getGenre().isBlank()) {
            record.put("genre", song.getGenre());
        }
        if (song.getDuration() != null && song.getDuration() > 0) {
            record.put("duration", song.getDuration());
        }
        if (song.getImageKey() != null && !song.getImageKey().isBlank()) {
            record.put("imageKey", song.getImageKey());
        }
        Long listenCount = (song.getSongMetadata() != null && song.getSongMetadata().getTotalStreams() != null)
                ? song.getSongMetadata().getTotalStreams()
                : 0L;
        record.put("listenCount", listenCount);
        searchClient.saveObject(indexName, record);
    }

    public void save(Artist artist) throws Exception {
        Map<String, Object> record = new HashMap<>();
        record.put("objectID", artist.getId());
        record.put("type", "artist");
        record.put("name", artist.getName());
        if (artist.getCoverImageKey() != null && !artist.getCoverImageKey().isBlank()) {
            record.put("coverImageKey", artist.getCoverImageKey());
        }
        searchClient.saveObject(indexName, record);
    }

    public void save(Playlist playlist) throws Exception {
        Map<String, Object> record = new HashMap<>();
        record.put("objectID", playlist.getId());
        record.put("type", "playlist");
        record.put("name", playlist.getName());
        if (playlist.getCoverImageKey() != null && !playlist.getCoverImageKey().isBlank()) {
            record.put("coverImageKey", playlist.getCoverImageKey());
        }
        record.put("totalSongs", playlist.getTotalSongs());
        searchClient.saveObject(indexName, record);
    }

    public void savePlaylist(String id, String name) throws Exception {
        Map<String, Object> record = new HashMap<>();
        record.put("objectID", id);
        record.put("type", "playlist");
        record.put("name", name);
        searchClient.saveObject(indexName, record);
    }

    public void save(UserPlaylist playlist) throws Exception {
        Map<String, Object> record = new HashMap<>();
        record.put("objectID", playlist.getId());
        record.put("type", "playlist");
        record.put("name", playlist.getName());
        record.put("totalSongs", playlist.getTotalSongs());
        searchClient.saveObject(indexName, record);
    }

    public void delete(String id) {
        searchClient.deleteObject(indexName, id);
    }

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

    public List<String> searchSongsByArtist(String query) {
        List<String> songIds = new ArrayList<>();
        if (query == null || query.isBlank()) {
            return songIds;
        }
        try {
            var response = searchClient.searchSingleIndex(
                    indexName,
                    new SearchParamsObject().setQuery(query).setHitsPerPage(50),
                    Map.class);

            for (var hit : response.getHits()) {
                @SuppressWarnings("unchecked")
                Map<String, Object> h = (Map<String, Object>) hit;
                String type = (String) h.get("type");
                if ("song".equals(type)) {
                    String objectId = (String) h.get("objectID");
                    if (objectId != null) {
                        songIds.add(objectId);
                    }
                }
            }
        } catch (Exception e) {
            log.error("Algolia search for artist songs failed: {}", e.getMessage(), e);
            throw new RuntimeException("Algolia search failed: " + e.getMessage(), e);
        }
        return songIds;
    }

    // ── Bulk resync ──

    public void reindexAllSongs(List<Song> songs) throws Exception {
        List<Map<String, Object>> records = new ArrayList<>();
        for (Song song : songs) {
            Map<String, Object> record = new HashMap<>();
            record.put("objectID", song.getId());
            record.put("type", "song");
            record.put("title", song.getTitle());
            record.put("artistName", song.getArtistName());
            record.put("album", song.getAlbum());
            record.put("language", song.getLanguage());
            if (song.getGenre() != null && !song.getGenre().isBlank()) {
                record.put("genre", song.getGenre());
            }
            if (song.getDuration() != null && song.getDuration() > 0) {
                record.put("duration", song.getDuration());
            }
            if (song.getImageKey() != null && !song.getImageKey().isBlank()) {
                record.put("imageKey", song.getImageKey());
            }
            Long listenCount = (song.getSongMetadata() != null && song.getSongMetadata().getTotalStreams() != null)
                    ? song.getSongMetadata().getTotalStreams()
                    : 0L;
            record.put("listenCount", listenCount);
            records.add(record);
        }
        if (!records.isEmpty()) {
            searchClient.saveObjects(indexName, records);
        }
        log.info("Reindexed {} songs in Algolia", songs.size());
    }

    public void reindexAllArtists(List<Artist> artists) throws Exception {
        List<Map<String, Object>> records = new ArrayList<>();
        for (Artist artist : artists) {
            Map<String, Object> record = new HashMap<>();
            record.put("objectID", artist.getId());
            record.put("type", "artist");
            record.put("name", artist.getName());
            if (artist.getCoverImageKey() != null && !artist.getCoverImageKey().isBlank()) {
                record.put("coverImageKey", artist.getCoverImageKey());
            }
            records.add(record);
        }
        if (!records.isEmpty()) {
            searchClient.saveObjects(indexName, records);
        }
        log.info("Reindexed {} artists in Algolia", artists.size());
    }

    public void reindexAllPlaylists(List<Playlist> playlists) throws Exception {
        List<Map<String, Object>> records = new ArrayList<>();
        for (Playlist playlist : playlists) {
            Map<String, Object> record = new HashMap<>();
            record.put("objectID", playlist.getId());
            record.put("type", "playlist");
            record.put("name", playlist.getName());
            if (playlist.getCoverImageKey() != null && !playlist.getCoverImageKey().isBlank()) {
                record.put("coverImageKey", playlist.getCoverImageKey());
            }
            record.put("totalSongs", playlist.getTotalSongs());
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
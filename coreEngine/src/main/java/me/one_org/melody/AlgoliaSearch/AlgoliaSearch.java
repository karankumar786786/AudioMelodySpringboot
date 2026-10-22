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


    public AlgoliaSearch(SearchClient searchClient){
        this.searchClient = searchClient;
    }

    @PostConstruct
    public void configureIndex() {
        try {
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
                            "desc(totalStreams)",
                            "desc(searchCount)")));
            log.info("Algolia index configured with searchable attributes, facets, and customRanking desc(totalStreams), desc(searchCount)");
        } catch (Exception e) {
            log.warn("Could not configure Algolia index on startup: {}", e.getMessage());
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

    public void incrementTotalStreams(String songId) {
        if (songId == null || songId.isBlank()) return;
        try {
            Map<String, Object> operation = new HashMap<>();
            operation.put("_operation", "Increment");
            operation.put("value", 1);

            Map<String, Object> update = new HashMap<>();
            update.put("totalStreams", operation);

            searchClient.partialUpdateObject(indexName, songId, update, true);
            log.info("Incremented Algolia totalStreams for song [{}]", songId);
        } catch (Exception e) {
            log.warn("Failed to increment totalStreams in Algolia for [{}]: {}", songId, e.getMessage());
        }
    }

    public Map<String, Object> buildSongRecord(Song song) {
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
        if (song.getSongKey() != null && !song.getSongKey().isBlank()) {
            record.put("songKey", song.getSongKey());
        }
        if (song.getVideoKey() != null && !song.getVideoKey().isBlank()) {
            record.put("videoKey", song.getVideoKey());
        }
        if (song.getPreviewStartTime() != null) {
            record.put("previewStartTime", song.getPreviewStartTime());
        }
        if (song.getPreviewEndTime() != null) {
            record.put("previewEndTime", song.getPreviewEndTime());
        }
        Long totalStreams = (song.getSongMetadata() != null && song.getSongMetadata().getTotalStreams() != null)
                ? song.getSongMetadata().getTotalStreams()
                : 0L;
        record.put("totalStreams", totalStreams);
        record.put("listenCount", totalStreams);
        return record;
    }

    public Map<String, Object> buildArtistRecord(Artist artist) {
        Map<String, Object> record = new HashMap<>();
        record.put("objectID", artist.getId());
        record.put("type", "artist");
        record.put("name", artist.getName());
        if (artist.getCoverImageKey() != null && !artist.getCoverImageKey().isBlank()) {
            record.put("coverImageKey", artist.getCoverImageKey());
        }
        Long followersCount = (artist.getArtistMetadata() != null && artist.getArtistMetadata().getFollowersCount() != null)
                ? artist.getArtistMetadata().getFollowersCount()
                : 0L;
        record.put("followersCount", followersCount);
        return record;
    }

    public Map<String, Object> buildPlaylistRecord(Playlist playlist) {
        Map<String, Object> record = new HashMap<>();
        record.put("objectID", playlist.getId());
        record.put("type", "playlist");
        record.put("name", playlist.getName());
        if (playlist.getCoverImageKey() != null && !playlist.getCoverImageKey().isBlank()) {
            record.put("coverImageKey", playlist.getCoverImageKey());
        }
        record.put("totalSongs", playlist.getTotalSongs());
        return record;
    }

    public void save(Song song) throws Exception {
        Map<String, Object> record = buildSongRecord(song);
        record.put("searchCount", 0L);
        searchClient.saveObject(indexName, record);
    }

    public void save(Artist artist) throws Exception {
        Map<String, Object> record = buildArtistRecord(artist);
        record.put("searchCount", 0L);
        searchClient.saveObject(indexName, record);
    }

    public void save(Playlist playlist) throws Exception {
        Map<String, Object> record = buildPlaylistRecord(playlist);
        record.put("searchCount", 0L);
        searchClient.saveObject(indexName, record);
    }

    public void savePlaylist(String id, String name) throws Exception {
        Map<String, Object> record = new HashMap<>();
        record.put("objectID", id);
        record.put("type", "playlist");
        record.put("name", name);
        record.put("searchCount", 0L);
        searchClient.saveObject(indexName, record);
    }

    public void save(UserPlaylist playlist) throws Exception {
        Map<String, Object> record = new HashMap<>();
        record.put("objectID", playlist.getId());
        record.put("type", "playlist");
        record.put("isUserPlaylist", true);
        if (playlist.getUser() != null) {
            record.put("ownerId", playlist.getUser().getId());
            if (playlist.getUser().getUserName() != null) {
                record.put("ownerName", playlist.getUser().getUserName());
            }
        }
        record.put("name", playlist.getName());
        record.put("totalSongs", playlist.getTotalSongs());
        record.put("searchCount", 0L);
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
                    new SearchParamsObject().setQuery(query).setHitsPerPage(100),
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

    public void reindexAllSongs(List<Song> songs) throws Exception {
        List<Map<String, Object>> records = songs.stream()
                .map(this::buildSongRecord)
                .toList();
        if (!records.isEmpty()) {
            searchClient.saveObjects(indexName, records);
        }
        log.info("Reindexed {} songs in Algolia", songs.size());
    }

    public void reindexAllArtists(List<Artist> artists) throws Exception {
        List<Map<String, Object>> records = artists.stream()
                .map(this::buildArtistRecord)
                .toList();
        if (!records.isEmpty()) {
            searchClient.saveObjects(indexName, records);
        }
        log.info("Reindexed {} artists in Algolia", artists.size());
    }

    public void reindexAllPlaylists(List<Playlist> playlists) throws Exception {
        List<Map<String, Object>> records = playlists.stream()
                .map(this::buildPlaylistRecord)
                .toList();
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
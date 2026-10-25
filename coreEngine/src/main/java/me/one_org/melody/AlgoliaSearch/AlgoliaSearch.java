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
import me.one_org.melody.Dto.AlgoliaSearch.SearchResult;
import me.one_org.melody.Dto.Controllers.Api.ArtistDto;
import me.one_org.melody.Dto.Controllers.Api.PlaylistDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Dto.Controllers.Api.UserPlaylistDto;
import me.one_org.melody.Entity.Artist;
import me.one_org.melody.Entity.Playlist;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Entity.UserPlaylist;
import me.one_org.melody.Dto.AlgoliaSearch.AlgoliaSearchArtistDto;
import me.one_org.melody.Dto.AlgoliaSearch.AlgoliaSearchPlaylistDto;
import me.one_org.melody.Enums.PlaylistPrivacyEnum;
import me.one_org.melody.Enums.StatusEnum;
import java.time.LocalDateTime;


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
                            "desc(searchCount)",
                            "desc(totalStreams)")));
            log.info("Algolia index configured with searchable attributes, facets, and customRanking desc(searchCount), desc(totalStreams)");
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
        if (song.getSongKey() != null && !song.getSongKey().isBlank()) {
            record.put("songKey", song.getSongKey());
            record.put("audioKey", song.getSongKey());
        }
        if (song.getImageKey() != null && !song.getImageKey().isBlank()) {
            record.put("imageKey", song.getImageKey());
        }
        if (song.getVideoKey() != null && !song.getVideoKey().isBlank()) {
            record.put("videoKey", song.getVideoKey());
            record.put("canvasKey", song.getVideoKey());
        }
        if (song.getFullVideoKey() != null && !song.getFullVideoKey().isBlank()) {
            record.put("fullVideoKey", song.getFullVideoKey());
        }
        if (song.getPreviewStartTime() != null) {
            record.put("previewStartTime", song.getPreviewStartTime());
        }
        if (song.getPreviewEndTime() != null) {
            record.put("previewEndTime", song.getPreviewEndTime());
        }
        record.put("isFeatured", song.getIsFeatured() != null ? song.getIsFeatured() : false);
        if (song.getLrclibId() != null && !song.getLrclibId().isBlank()) {
            record.put("lrclibId", song.getLrclibId());
        }
        if (song.getStatus() != null) {
            record.put("status", song.getStatus().name());
        }
        if (song.getJobId() != null && !song.getJobId().isBlank()) {
            record.put("jobId", song.getJobId());
        }
        if (song.getCreatedAt() != null) {
            record.put("createdAt", song.getCreatedAt().toString());
        }
        Long totalStreams = (song.getSongMetadata() != null && song.getSongMetadata().getTotalStreams() != null)
                ? song.getSongMetadata().getTotalStreams()
                : 0L;
        record.put("totalStreams", totalStreams);
        record.put("searchCount", 0L);
        return record;
    }

    public Map<String, Object> buildArtistRecord(Artist artist) {
        Map<String, Object> record = new HashMap<>();
        record.put("objectID", artist.getId());
        record.put("type", "artist");
        record.put("name", artist.getName());
        if (artist.getAbout() != null && !artist.getAbout().isBlank()) {
            record.put("about", artist.getAbout());
        }
        if (artist.getDob() != null) {
            record.put("dob", artist.getDob().toString());
        }
        if (artist.getCoverImageKey() != null && !artist.getCoverImageKey().isBlank()) {
            record.put("coverImageKey", artist.getCoverImageKey());
        }
        if (artist.getStatus() != null) {
            record.put("status", artist.getStatus().name());
        }
        if (artist.getCreatedAt() != null) {
            record.put("createdAt", artist.getCreatedAt().toString());
        }
        Long followersCount = (artist.getArtistMetadata() != null && artist.getArtistMetadata().getFollowersCount() != null)
                ? artist.getArtistMetadata().getFollowersCount()
                : 0L;
        record.put("followersCount", followersCount);
        record.put("searchCount", 0L);
        return record;
    }

    public Map<String, Object> buildPlaylistRecord(Playlist playlist) {
        Map<String, Object> record = new HashMap<>();
        record.put("objectID", playlist.getId());
        record.put("type", "playlist");
        record.put("name", playlist.getName());
        if (playlist.getDescription() != null && !playlist.getDescription().isBlank()) {
            record.put("description", playlist.getDescription());
        }
        if (playlist.getCoverImageKey() != null && !playlist.getCoverImageKey().isBlank()) {
            record.put("coverImageKey", playlist.getCoverImageKey());
        }
        if (playlist.getVideoKey() != null && !playlist.getVideoKey().isBlank()) {
            record.put("videoKey", playlist.getVideoKey());
        }
        record.put("totalSongs", playlist.getTotalSongs());
        if (playlist.getStatus() != null) {
            record.put("status", playlist.getStatus().name());
        }
        if (playlist.getCreatedAt() != null) {
            record.put("createdAt", playlist.getCreatedAt().toString());
        }
        if (playlist.getUpdatedAt() != null) {
            record.put("updatedAt", playlist.getUpdatedAt().toString());
        }
        record.put("searchCount", 0L);
        return record;
    }

    public Map<String, Object> buildUserPlaylistRecord(UserPlaylist playlist) {
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
        if (playlist.getPrivacy() != null) {
            record.put("privacy", playlist.getPrivacy().name());
        }
        if (playlist.getShareToken() != null) {
            record.put("shareToken", playlist.getShareToken());
        }
        record.put("totalSongs", playlist.getTotalSongs());
        record.put("searchCount", 0L);
        return record;
    }

    public void save(Song song) throws Exception {
        Map<String, Object> record = buildSongRecord(song);
        searchClient.saveObject(indexName, record);
    }

    public void save(Artist artist) throws Exception {
        Map<String, Object> record = buildArtistRecord(artist);
        searchClient.saveObject(indexName, record);
    }

    public void save(Playlist playlist) throws Exception {
        Map<String, Object> record = buildPlaylistRecord(playlist);
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
        Map<String, Object> record = buildUserPlaylistRecord(playlist);
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

    public SearchResult searchDetailed(String query) {
        List<SongDto> songs = new ArrayList<>();
        List<ArtistDto> artists = new ArrayList<>();
        List<PlaylistDto> playlists = new ArrayList<>();
        List<UserPlaylistDto> userPlaylists = new ArrayList<>();

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

                switch (type) {
                    case "song" -> {
                        SongDto s = mapHitToSongDto(h);
                        if (s != null) songs.add(s);
                    }
                    case "artist" -> {
                        ArtistDto a = mapHitToArtistDto(h);
                        if (a != null) artists.add(a);
                    }
                    case "playlist" -> {
                        if (Boolean.TRUE.equals(h.get("isUserPlaylist"))) {
                            UserPlaylistDto up = mapHitToUserPlaylistDto(h);
                            if (up != null) userPlaylists.add(up);
                        } else {
                            PlaylistDto pl = mapHitToPlaylistDto(h);
                            if (pl != null) playlists.add(pl);
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.error("Algolia searchDetailed failed for query '{}': {}", query, e.getMessage());
            throw new RuntimeException("Algolia search failed: " + e.getMessage(), e);
        }
        return new SearchResult(songs, artists, playlists, userPlaylists);
    }

    private SongDto mapHitToSongDto(Map<String, Object> h) {
        String id = (String) h.get("objectID");
        if (id == null) return null;
        String title = (String) h.get("title");
        String artistName = (String) h.get("artistName");
        Integer duration = h.get("duration") instanceof Number n ? n.intValue() : null;
        String songKey = (String) h.get("songKey");
        String imageKey = (String) h.get("imageKey");
        String videoKey = (String) h.get("videoKey");
        String fullVideoKey = (String) h.get("fullVideoKey");
        Integer previewStartTime = h.get("previewStartTime") instanceof Number n ? n.intValue() : null;
        Integer previewEndTime = h.get("previewEndTime") instanceof Number n ? n.intValue() : null;
        Boolean isFeatured = h.get("isFeatured") instanceof Boolean b ? b : false;
        String language = (String) h.get("language");
        String genre = (String) h.get("genre");
        String album = (String) h.get("album");
        String lrclibId = (String) h.get("lrclibId");

        StatusEnum status = null;
        if (h.get("status") instanceof String s) {
            try { status = StatusEnum.valueOf(s); } catch (Exception ignored) {}
        }
        String jobId = (String) h.get("jobId");
        Long totalStreams = h.get("totalStreams") instanceof Number n ? n.longValue() : 0L;

        LocalDateTime createdAt = null;
        if (h.get("createdAt") instanceof String s) {
            try { createdAt = LocalDateTime.parse(s); } catch (Exception ignored) {}
        }

        return new SongDto(
            id, title, artistName, duration, songKey, imageKey,
            videoKey, fullVideoKey, previewStartTime, previewEndTime,
            isFeatured, language, genre, album, lrclibId,
            status, jobId, totalStreams, createdAt
        );
    }

    private ArtistDto mapHitToArtistDto(Map<String, Object> h) {
        String id = (String) h.get("objectID");
        if (id == null) return null;
        String name = (String) h.get("name");
        String about = (String) h.get("about");
        LocalDateTime dob = null;
        if (h.get("dob") instanceof String s) {
            try { dob = LocalDateTime.parse(s); } catch (Exception ignored) {}
        }
        String coverImageKey = (String) h.get("coverImageKey");
        StatusEnum status = null;
        if (h.get("status") instanceof String s) {
            try { status = StatusEnum.valueOf(s); } catch (Exception ignored) {}
        }
        Long followersCount = h.get("followersCount") instanceof Number n ? n.longValue() : 0L;
        LocalDateTime createdAt = null;
        if (h.get("createdAt") instanceof String s) {
            try { createdAt = LocalDateTime.parse(s); } catch (Exception ignored) {}
        }
        return new ArtistDto(id, name, about, dob, coverImageKey, status, followersCount, createdAt);
    }

    private PlaylistDto mapHitToPlaylistDto(Map<String, Object> h) {
        String id = (String) h.get("objectID");
        if (id == null) return null;
        String name = (String) h.get("name");
        String description = (String) h.get("description");
        String coverImageKey = (String) h.get("coverImageKey");
        String videoKey = (String) h.get("videoKey");
        int totalSongs = h.get("totalSongs") instanceof Number n ? n.intValue() : 0;
        StatusEnum status = null;
        if (h.get("status") instanceof String s) {
            try { status = StatusEnum.valueOf(s); } catch (Exception ignored) {}
        }
        LocalDateTime createdAt = null;
        if (h.get("createdAt") instanceof String s) {
            try { createdAt = LocalDateTime.parse(s); } catch (Exception ignored) {}
        }
        LocalDateTime updatedAt = null;
        if (h.get("updatedAt") instanceof String s) {
            try { updatedAt = LocalDateTime.parse(s); } catch (Exception ignored) {}
        }
        return new PlaylistDto(id, name, description, coverImageKey, videoKey, totalSongs, status, createdAt, updatedAt);
    }

    private UserPlaylistDto mapHitToUserPlaylistDto(Map<String, Object> h) {
        String id = (String) h.get("objectID");
        if (id == null) return null;
        String name = (String) h.get("name");
        PlaylistPrivacyEnum privacy = PlaylistPrivacyEnum.PUBLIC;
        if (h.get("privacy") instanceof String s) {
            try { privacy = PlaylistPrivacyEnum.valueOf(s); } catch (Exception ignored) {}
        }
        String shareToken = (String) h.get("shareToken");
        int totalSongs = h.get("totalSongs") instanceof Number n ? n.intValue() : 0;
        String ownerId = (String) h.get("ownerId");
        String ownerName = (String) h.get("ownerName");
        return new UserPlaylistDto(id, name, privacy, shareToken, totalSongs, ownerId, ownerId, ownerName);
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

    public void reindexAllUserPlaylists(List<UserPlaylist> playlists) throws Exception {
        List<Map<String, Object>> records = playlists.stream()
                .map(this::buildUserPlaylistRecord)
                .toList();
        if (!records.isEmpty()) {
            searchClient.saveObjects(indexName, records);
        }
        log.info("Reindexed {} user playlists in Algolia", playlists.size());
    }

    public void clearIndex() throws Exception {
        searchClient.clearObjects(indexName);
        log.info("Algolia index '{}' cleared", indexName);
    }
}
package me.one_org.melody.Utils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.algolia.api.SearchClient;
import com.algolia.model.search.*;

import jakarta.annotation.PostConstruct;
import me.one_org.melody.Dto.SearchResult;
import me.one_org.melody.Entity.Artists;
import me.one_org.melody.Entity.Playlists;
import me.one_org.melody.Entity.Songs;

@Component
public class SearchUtil {

    @Autowired
    private SearchClient searchClient;

    @Value("${algolia.index-name}")
    private String indexName;

    @PostConstruct
    public void configureIndex() throws Exception {
        searchClient.setSettings(indexName, new IndexSettings().setSearchableAttributes(List.of(
                "title",
                "artistName",
                "language",
                "name")));
    }

    public void save(Songs songs) throws Exception {
        Map<String, Object> record = new HashMap<>();
        record.put("objectID", songs.getId()); // capital ID is required by Algolia
        record.put("type", "song");
        record.put("title", songs.getTitle());
        record.put("artistName", songs.getArtistName());
        record.put("duration", songs.getDuration());
        record.put("songKey", songs.getSongKey());
        record.put("imageKey", songs.getImageKey());
        record.put("language", songs.getLanguage());
        searchClient.saveObject(indexName, record);
    }

    public void save(Artists artists) throws Exception {
        Map<String, Object> record = new HashMap<>();
        record.put("objectID", artists.getId());
        record.put("type", "artist");
        record.put("name", artists.getName());
        record.put("about", artists.getAbout());
        record.put("dob", artists.getDob() != null ? artists.getDob().toEpochSecond(java.time.ZoneOffset.UTC) : null);
        record.put("coverImageKey", artists.getCoverImageKey());
        record.put("bannerImageKey", artists.getBannerImageKey());
        searchClient.saveObject(indexName, record);
    }

    public void save(Playlists playlists) throws Exception {
        Map<String, Object> record = new HashMap<>();
        record.put("objectID", playlists.getId());
        record.put("type", "playlist");
        record.put("name", playlists.getName());
        record.put("description", playlists.getDescription());
        record.put("coverImageKey", playlists.getCoverImageKey());
        record.put("bannerImageKey", playlists.getBannerImageKey());
        searchClient.saveObject(indexName, record);
    }

    public void delete(String id) {
        searchClient.deleteObject(indexName, id);
    }

    public SearchResult search(String query) {
        List<Songs> songs = new ArrayList<>();
        List<Artists> artists = new ArrayList<>();
        List<Playlists> playlists = new ArrayList<>();

        try {
            var response = searchClient.searchSingleIndex(
                    indexName,
                    new SearchParamsObject().setQuery(query).setHitsPerPage(20),
                    Map.class);

            for (var hit : response.getHits()) {
                @SuppressWarnings("unchecked")
                Map<String, Object> h = (Map<String, Object>) hit;
                String type = (String) h.get("type");
                if (type == null)
                    continue;
                switch (type) {
                    case "song" -> {
                        Songs song = Songs.builder()
                                .id((String) h.get("objectID"))
                                .title((String) h.get("title"))
                                .artistName((String) h.get("artistName"))
                                .duration(h.get("duration") != null ? ((Number) h.get("duration")).intValue() : null)
                                .songKey((String) h.get("songKey"))
                                .imageKey((String) h.get("imageKey"))
                                .language((String) h.get("language"))
                                .build();
                        songs.add(song);
                    }
                    case "artist" -> {
                        Artists artist = Artists.builder()
                                .id((String) h.get("objectID"))
                                .name((String) h.get("name"))
                                .about((String) h.get("about"))
                                .coverImageKey((String) h.get("coverImageKey"))
                                .bannerImageKey((String) h.get("bannerImageKey"))
                                .dob(h.get("dob") != null
                                        ? LocalDateTime.ofEpochSecond(((Number) h.get("dob")).longValue(), 0,
                                                java.time.ZoneOffset.UTC)
                                        : null)
                                .build();
                        artists.add(artist);
                    }
                    case "playlist" -> {
                        Playlists playlist = Playlists.builder()
                                .id((String) h.get("objectID"))
                                .name((String) h.get("name"))
                                .description((String) h.get("description"))
                                .coverImageKey((String) h.get("coverImageKey"))
                                .bannerImageKey((String) h.get("bannerImageKey"))
                                .build();
                        playlists.add(playlist);
                    }
                }
            }
        } catch (Exception e) {
            throw new RuntimeException("Algolia search failed: " + e.getMessage(), e);
        }
        return new SearchResult(songs, artists, playlists);
    }
}
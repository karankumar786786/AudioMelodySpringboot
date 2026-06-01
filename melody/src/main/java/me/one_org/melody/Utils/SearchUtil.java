package me.one_org.melody.Utils;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.algolia.api.SearchClient;

import me.one_org.melody.Configuration.AlgoliaSearch;
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

    public void save(Songs songs) throws Exception {
        Map<String,Object> record = new HashMap<>();
        record.put("objectId", songs.getId());
        record.put("artistName", songs.getArtistName());
        record.put("duration", songs.getDuration());
        record.put("songKey", songs.getSongKey());
        record.put("imageKey", songs.getImageKey());
        record.put("language", songs.getLanguage());
        record.put("jobId", songs.getJobId());
        searchClient.saveObject(indexName, record);
    }
    public void save(Artists artists) throws Exception {
        Map<String,Object> record = new HashMap<>();
        record.put("objectId", artists.getId());
        record.put("name", artists.getName());
        record.put("about", artists.getAbout());
        record.put("dob", artists.getDob());
        record.put("coverImageKey", artists.getCoverImageKey());
        record.put("bannerImageKey", artists.getBannerImageKey());
        searchClient.saveObject(indexName, record);
    }
    public void save(Playlists playlists){
        Map<String,Object> record = new HashMap<>();
        record.put("objectId", playlists.getId());
        record.put("name", playlists.getName());
        record.put("coverImageKey", playlists.getCoverImageKey());
        record.put("bannerImageKey", playlists.getBannerImageKey());
        searchClient.saveObject(indexName, record);
    }
    public void delete(String id){
        searchClient.deleteObject(indexName, id);
    }

    public SearchResult search(String query){
        // searchClient.se
        return null;
    }
}


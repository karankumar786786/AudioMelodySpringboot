package me.one_org.melody.Recommendation;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;


import org.springframework.stereotype.Component;

import com.recombee.api_client.RecombeeClient;
import com.recombee.api_client.api_requests.*;
import com.recombee.api_client.bindings.Recommendation;
import com.recombee.api_client.bindings.RecommendationResponse;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Entity.SongsEntity;

/*
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                    RATING SCALE (-1.0 to 1.0)               ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  Action                        Rating   Signal Strength      ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  Explicit skip                 -1.0     Strongest negative   ║
 * ║  Removed from favourites       -0.5     Strong negative      ║
 * ║  Removed from playlist         -0.4     Moderate negative    ║
 * ║  Listened < 25%  (drop-off)    -0.3     Soft negative        ║
 * ║  Listened 25-50% (partial)      0.1     Weak positive        ║
 * ║  Listened 50-90% (good)         0.3     Moderate positive    ║
 * ║  Listened >= 90% (completed)    0.7     Strong positive      ║
 * ║  Added to playlist              0.8     Stronger positive    ║
 * ║  Added to favourites            1.0     Strongest positive   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

@Component
@Slf4j
public class Recombee {


    private final RecombeeClient recombeeClient;


    public Recombee(RecombeeClient recombeeClient) {
        this.recombeeClient = recombeeClient;
    }

    @PostConstruct
    public void configureSchema() throws Exception {
        // Register item properties — these define what metadata Recombee knows about each song
        try {
            recombeeClient.send(new AddItemProperty("title", "string"));
            recombeeClient.send(new AddItemProperty("artistName", "string"));
            recombeeClient.send(new AddItemProperty("language", "string"));
            log.info("Recombee item properties registered successfully");
        } catch (Exception e) {
            // Properties may already exist — Recombee throws if re-adding
            log.debug("Recombee properties may already exist: {}", e.getMessage());
        }
    }

    // ── Save song item with properties ──

    public void saveSong(SongsEntity song) throws Exception {
        Map<String, Object> values = new HashMap<>();
        values.put("title", song.getTitle());
        values.put("artistName", song.getArtistName());
        values.put("language", song.getLanguage());
        recombeeClient.send(new SetItemValues(song.getId(), values).setCascadeCreate(true));
    }

    public void saveSong(String songId, String title, String artistName, String language) throws Exception {
        Map<String, Object> values = new HashMap<>();
        values.put("title", title);
        values.put("artistName", artistName);
        values.put("language", language);
        recombeeClient.send(new SetItemValues(songId, values).setCascadeCreate(true));
    }

    public void delete(String songId) throws Exception {
        recombeeClient.send(new DeleteItem(songId));
    }

    public void addUser(String userId) throws Exception {
        recombeeClient.send(new AddUser(userId));
    }

    public void deleteUser(String userId) throws Exception {
        recombeeClient.send(new DeleteUser(userId));
    }

    // ── Interaction tracking ──

    // percentage: 0.0 - 1.0 (e.g. 0.87 means 87% of song was listened)
    public void trackPlay(String userId, String songId, double percentage) throws Exception {
        double rating;
        if (percentage >= 0.90) {
            rating = 0.7; // completed — strong positive
        } else if (percentage >= 0.50) {
            rating = 0.3; // good listen — moderate positive
        } else if (percentage >= 0.25) {
            rating = 0.1; // partial — weak positive
        } else {
            rating = -0.3; // drop-off — soft negative
        }
        recombeeClient.send(new AddRating(userId, songId, rating).setCascadeCreate(true));
    }

    // explicit skip button pressed
    public void trackSkip(String userId, String songId) throws Exception {
        recombeeClient.send(new AddRating(userId, songId, -1.0).setCascadeCreate(true));
    }

    // added to favourites
    public void trackFavouriteAdd(String userId, String songId) throws Exception {
        recombeeClient.send(new AddRating(userId, songId, 1.0).setCascadeCreate(true));
    }

    // removed from favourites
    public void trackFavouriteRemove(String userId, String songId) throws Exception {
        recombeeClient.send(new AddRating(userId, songId, -0.5).setCascadeCreate(true));
    }

    // added to user's own playlist
    public void trackPlaylistAdd(String userId, String songId) throws Exception {
        recombeeClient.send(new AddRating(userId, songId, 0.8).setCascadeCreate(true));
    }

    // removed from user's own playlist
    public void trackPlaylistRemove(String userId, String songId) throws Exception {
        recombeeClient.send(new AddRating(userId, songId, -0.4).setCascadeCreate(true));
    }

    // ── Recommendations — return only IDs, caller fetches from DB ──

    public List<String> recommendForUser(String userId, int count) throws Exception {
        RecommendationResponse response = recombeeClient.send(
                new RecommendItemsToUser(userId, count)
                        .setCascadeCreate(true));
        List<String> songIds = new ArrayList<>();
        for (Recommendation hit : response) {
            songIds.add(hit.getId());
        }
        return songIds;
    }

    public List<String> recommendSimilar(String songId, int count) throws Exception {
        RecommendationResponse response = recombeeClient.send(
                new RecommendItemsToItem(songId, null, count));
        List<String> songIds = new ArrayList<>();
        for (Recommendation hit : response) {
            songIds.add(hit.getId());
        }
        return songIds;
    }

    // ── Bulk resync ──

    public void reindexAll(List<SongsEntity> songs) throws Exception {
        ArrayList<Request> requests = new ArrayList<>();
        for (SongsEntity song : songs) {
            Map<String, Object> values = new HashMap<>();
            values.put("title", song.getTitle());
            values.put("artistName", song.getArtistName());
            values.put("language", song.getLanguage());
            requests.add(new SetItemValues(song.getId(), values).setCascadeCreate(true));
        }
        if (!requests.isEmpty()) {
            recombeeClient.send(new Batch(requests));
        }
        log.info("Reindexed {} songs in Recombee", songs.size());
    }
}
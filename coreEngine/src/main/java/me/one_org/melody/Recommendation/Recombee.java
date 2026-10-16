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
import me.one_org.melody.Entity.Song;

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

    private static final long DEFAULT_TIMEOUT_MS = 3000L; // 3 seconds resilient timeout

    private final RecombeeClient recombeeClient;

    public Recombee(RecombeeClient recombeeClient) {
        this.recombeeClient = recombeeClient;
    }

    private <T extends Request> T withTimeout(T request) {
        if (request != null) {
            request.setTimeout(DEFAULT_TIMEOUT_MS);
        }
        return request;
    }

    private static final String TOTAL_STREAMS_BOOSTER =
            "if 'totalStreams' != null and 'totalStreams' > 0 then (if 'totalStreams' > 5000 then 1.4 else if 'totalStreams' > 500 then 1.25 else if 'totalStreams' > 50 then 1.1 else 1.03) else 1.0";

    @PostConstruct
    public void configureSchema() {
        // Register each item property independently so existence of one does not abort remaining registrations
        registerPropertySafely("title", "string");
        registerPropertySafely("artistName", "string");
        registerPropertySafely("language", "string");
        registerPropertySafely("genre", "string");
        registerPropertySafely("album", "string");
        registerPropertySafely("duration", "int");
        registerPropertySafely("totalStreams", "int");
    }

    private void registerPropertySafely(String name, String type) {
        try {
            recombeeClient.send(withTimeout(new AddItemProperty(name, type)));
            log.info("Recombee item property '{}' ({}) registered successfully", name, type);
        } catch (Exception e) {
            // Property already exists or transient network note
            log.debug("Recombee property '{}' check/register note: {}", name, e.getMessage());
        }
    }

    // ── Save song item with properties ──

    public void saveSong(Song song) throws Exception {
        Map<String, Object> values = new HashMap<>();
        values.put("title", song.getTitle());
        values.put("artistName", song.getArtistName());
        values.put("language", song.getLanguage());
        if (song.getGenre() != null && !song.getGenre().isBlank()) {
            values.put("genre", song.getGenre());
        }
        if (song.getAlbum() != null && !song.getAlbum().isBlank()) {
            values.put("album", song.getAlbum());
        }
        if (song.getDuration() != null && song.getDuration() > 0) {
            values.put("duration", song.getDuration());
        }
        Long totalStreams = (song.getSongMetadata() != null && song.getSongMetadata().getTotalStreams() != null)
                ? song.getSongMetadata().getTotalStreams()
                : 0L;
        values.put("totalStreams", (int) Math.min(totalStreams, Integer.MAX_VALUE));
        recombeeClient.send(withTimeout(new SetItemValues(song.getId(), values).setCascadeCreate(true)));
    }

    public void updateTotalStreams(String songId, long totalStreams) throws Exception {
        Map<String, Object> values = new HashMap<>();
        values.put("totalStreams", (int) Math.min(totalStreams, Integer.MAX_VALUE));
        recombeeClient.send(withTimeout(new SetItemValues(songId, values).setCascadeCreate(true)));
    }

    public void saveSong(String songId, String title, String artistName, String language, String genre) throws Exception {
        saveSong(songId, title, artistName, language, genre, null, 0L);
    }

    public void saveSong(String songId, String title, String artistName, String language, String genre, Integer duration) throws Exception {
        saveSong(songId, title, artistName, language, genre, duration, 0L);
    }

    public void saveSong(String songId, String title, String artistName, String language, String genre, Integer duration, Long totalStreams) throws Exception {
        Map<String, Object> values = new HashMap<>();
        values.put("title", title);
        values.put("artistName", artistName);
        values.put("language", language);
        if (genre != null && !genre.isBlank()) {
            values.put("genre", genre);
        }
        if (duration != null && duration > 0) {
            values.put("duration", duration);
        }
        if (totalStreams != null && totalStreams >= 0) {
            values.put("totalStreams", (int) Math.min(totalStreams, Integer.MAX_VALUE));
        }
        recombeeClient.send(withTimeout(new SetItemValues(songId, values).setCascadeCreate(true)));
    }

    public void delete(String songId) throws Exception {
        recombeeClient.send(withTimeout(new DeleteItem(songId)));
    }

    public void addUser(String userId) throws Exception {
        recombeeClient.send(withTimeout(new AddUser(userId)));
    }

    public void deleteUser(String userId) throws Exception {
        recombeeClient.send(withTimeout(new DeleteUser(userId)));
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
        recombeeClient.send(withTimeout(new AddRating(userId, songId, rating).setCascadeCreate(true)));
    }

    // explicit skip button pressed
    public void trackSkip(String userId, String songId) throws Exception {
        recombeeClient.send(withTimeout(new AddRating(userId, songId, -1.0).setCascadeCreate(true)));
    }

    // user played a song that appeared in search results — strong active-discovery signal
    public void trackSearchPlay(String userId, String songId) throws Exception {
        recombeeClient.send(withTimeout(new AddDetailView(userId, songId).setCascadeCreate(true)));
    }

    // user explicitly added a song to their queue — strong intent signal
    public void trackQueueAdd(String userId, String songId) throws Exception {
        recombeeClient.send(withTimeout(new AddBookmark(userId, songId).setCascadeCreate(true)));
    }

    // user explicitly removed a song from their queue — negative intent signal
    public void trackQueueRemove(String userId, String songId) throws Exception {
        try {
            recombeeClient.send(withTimeout(new DeleteBookmark(userId, songId)));
        } catch (Exception ignored) {
            // Bookmark may not exist if song was queued from radio/playlist
        }
        recombeeClient.send(withTimeout(new AddRating(userId, songId, -0.4).setCascadeCreate(true)));
    }

    // added to favourites
    public void trackFavouriteAdd(String userId, String songId) throws Exception {
        recombeeClient.send(withTimeout(new AddRating(userId, songId, 1.0).setCascadeCreate(true)));
    }

    // removed from favourites
    public void trackFavouriteRemove(String userId, String songId) throws Exception {
        recombeeClient.send(withTimeout(new AddRating(userId, songId, -0.5).setCascadeCreate(true)));
    }

    // added to user's own playlist
    public void trackPlaylistAdd(String userId, String songId) throws Exception {
        recombeeClient.send(withTimeout(new AddRating(userId, songId, 0.8).setCascadeCreate(true)));
    }

    // removed from user's own playlist
    public void trackPlaylistRemove(String userId, String songId) throws Exception {
        recombeeClient.send(withTimeout(new AddRating(userId, songId, -0.4).setCascadeCreate(true)));
    }

    // user explicitly disliked / hid a song — strong negative signal
    public void trackDislike(String userId, String songId) throws Exception {
        recombeeClient.send(withTimeout(new AddRating(userId, songId, -1.0).setCascadeCreate(true)));
    }

    // user shared a song — high intent advocacy signal
    public void trackShare(String userId, String songId) throws Exception {
        recombeeClient.send(withTimeout(new AddRating(userId, songId, 0.6).setCascadeCreate(true)));
    }

    // added to artist follow — highest user advocacy signal
    public void trackArtistFollow(String userId, String artistId) throws Exception {
        recombeeClient.send(withTimeout(new AddRating(userId, artistId, 1.0).setCascadeCreate(true)));
    }

    // removed from artist follow — negative preference adjustment
    public void trackArtistUnfollow(String userId, String artistId) throws Exception {
        recombeeClient.send(withTimeout(new AddRating(userId, artistId, -0.5).setCascadeCreate(true)));
    }

    // ── Recommendations — return only IDs, caller fetches from DB ──

    public List<String> recommendForUser(String userId, int count) throws Exception {
        RecommendationResponse response;
        try {
            response = recombeeClient.send(
                    withTimeout(new RecommendItemsToUser(userId, count)
                            .setCascadeCreate(true)
                            .setBooster(TOTAL_STREAMS_BOOSTER)));
        } catch (Exception e) {
            log.warn("Recombee recommendForUser with booster failed, retrying without booster: {}", e.getMessage());
            response = recombeeClient.send(
                    withTimeout(new RecommendItemsToUser(userId, count)
                            .setCascadeCreate(true)));
        }
        List<String> songIds = new ArrayList<>();
        for (Recommendation hit : response) {
            songIds.add(hit.getId());
        }
        return songIds;
    }

    public List<String> recommendSimilar(String songId, int count) throws Exception {
        RecommendationResponse response;
        try {
            response = recombeeClient.send(
                    withTimeout(new RecommendItemsToItem(songId, null, count)
                            .setBooster(TOTAL_STREAMS_BOOSTER)));
        } catch (Exception e) {
            log.warn("Recombee recommendSimilar with booster failed, retrying without booster: {}", e.getMessage());
            response = recombeeClient.send(
                    withTimeout(new RecommendItemsToItem(songId, null, count)));
        }
        List<String> songIds = new ArrayList<>();
        for (Recommendation hit : response) {
            songIds.add(hit.getId());
        }
        return songIds;
    }

    /**
     * Sequential "what to play next" recommendation.
     * Uses RecommendNextItems which accounts for the user's current listening sequence,
     * producing better auto-play transitions than generic item-to-item similarity.
     */
    public List<String> recommendNextItems(String userId, String recommId, int count) throws Exception {
        RecommendationResponse response = recombeeClient.send(
                withTimeout(new RecommendNextItems(recommId, count)));
        List<String> songIds = new ArrayList<>();
        for (Recommendation hit : response) {
            songIds.add(hit.getId());
        }
        return songIds;
    }

    // ── Bulk resync ──

    public void reindexAll(List<Song> songs) throws Exception {
        ArrayList<Request> requests = new ArrayList<>();
        for (Song song : songs) {
            Map<String, Object> values = new HashMap<>();
            values.put("title", song.getTitle());
            values.put("artistName", song.getArtistName());
            values.put("language", song.getLanguage());
            if (song.getGenre() != null && !song.getGenre().isBlank()) {
                values.put("genre", song.getGenre());
            }
            if (song.getDuration() != null && song.getDuration() > 0) {
                values.put("duration", song.getDuration());
            }
            Long totalStreams = (song.getSongMetadata() != null && song.getSongMetadata().getTotalStreams() != null)
                    ? song.getSongMetadata().getTotalStreams()
                    : 0L;
            values.put("totalStreams", (int) Math.min(totalStreams, Integer.MAX_VALUE));
            requests.add(withTimeout(new SetItemValues(song.getId(), values).setCascadeCreate(true)));
        }
        if (!requests.isEmpty()) {
            recombeeClient.send(withTimeout(new Batch(requests)));
        }
        log.info("Reindexed {} songs in Recombee", songs.size());
    }
}
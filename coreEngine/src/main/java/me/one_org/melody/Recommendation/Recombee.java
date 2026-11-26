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
import me.one_org.melody.Dto.Controllers.Api.RadioResponseDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Enums.StatusEnum;
import java.time.LocalDateTime;

/**
 * Recombee (recommendation service) ka client: songs/users ka data bhejna, user ke actions ko "rating"
 * ki tarah bhejna, aur recommendations lena. Har call ka timeout 3 second hai.
 *
 * Recombee har user-song jodi ki rating (-1 se +1) se seekhta hai ki kise kya pasand hai.
 * Hum user ke actions ko is table ke hisaab se rating me badalte hain:
 *
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

    private static final long DEFAULT_TIMEOUT_MS = 3000L; // har Recombee call max 3 second

    private final RecombeeClient recombeeClient;

    public Recombee(RecombeeClient recombeeClient) {
        this.recombeeClient = recombeeClient;
    }

    /** Har request pe 3 second ka timeout laga do. */
    private <T extends Request> T withTimeout(T request) {
        if (request != null) {
            request.setTimeout(DEFAULT_TIMEOUT_MS);
        }
        return request;
    }

    /** Recombee ka booster formula: zyada streams wale gaane thode upar (5000+ = 1.4x, 500+ = 1.25x, 50+ = 1.1x). */
    private static final String TOTAL_STREAMS_BOOSTER =
            "if 'totalStreams' != null and 'totalStreams' > 0 then (if 'totalStreams' > 5000 then 1.4 else if 'totalStreams' > 500 then 1.25 else if 'totalStreams' > 50 then 1.1 else 1.03) else 1.0";

    /** Startup pe Recombee me song ki properties (title, artist, genre, audio features...) register karo. */
    @PostConstruct
    public void configureSchema() {
        // Har property alag alag register karo - ek pehle se ho (error) to baaki rukni nahi chahiye
        registerPropertySafely("title", "string");
        registerPropertySafely("artistName", "string");
        registerPropertySafely("artists", "set");
        registerPropertySafely("language", "string");
        registerPropertySafely("genre", "string");
        registerPropertySafely("genres", "set");
        registerPropertySafely("album", "string");
        registerPropertySafely("country", "string");
        registerPropertySafely("duration", "int");
        registerPropertySafely("totalStreams", "int");
        registerPropertySafely("imageKey", "string");
        registerPropertySafely("songKey", "string");
        registerPropertySafely("audioKey", "string");
        registerPropertySafely("videoKey", "string");
        registerPropertySafely("canvasKey", "string");
        registerPropertySafely("fullVideoKey", "string");
        registerPropertySafely("previewStartTime", "int");
        registerPropertySafely("previewEndTime", "int");
        registerPropertySafely("clipStartSec", "int");
        registerPropertySafely("clipEndSec", "int");
        registerPropertySafely("canvasStartTime", "int");
        registerPropertySafely("canvasEndTime", "int");
        registerPropertySafely("isFeatured", "boolean");
        registerPropertySafely("lrclibId", "string");
        registerPropertySafely("status", "string");
        registerPropertySafely("jobId", "string");
        registerPropertySafely("createdAt", "string");

        // Audio features bhi - taaki Recombee awaaz ke hisaab se bhi milte-julte gaane de
        registerPropertySafely("tempo", "double");
        registerPropertySafely("danceability", "double");
        registerPropertySafely("energy", "double");
        registerPropertySafely("valence", "double");
        registerPropertySafely("acousticness", "double");
        registerPropertySafely("instrumentalness", "double");
        registerPropertySafely("liveness", "double");
        registerPropertySafely("speechiness", "double");
        registerPropertySafely("loudness", "double");
        registerPropertySafely("key", "int");
        registerPropertySafely("mode", "int");
    }

    /** Ek property register karo; pehle se ho to error ignore. */
    private void registerPropertySafely(String name, String type) {
        try {
            recombeeClient.send(withTimeout(new AddItemProperty(name, type)));
            log.info("Recombee item property '{}' ({}) registered successfully", name, type);
        } catch (Exception e) {
            // Property pehle se hai (ya network ki chhoti dikkat) - koi baat nahi
            log.debug("Recombee property '{}' check/register note: {}", name, e.getMessage());
        }
    }

    // ── Song ko Recombee me item ki tarah save karna ──

    /** "Pop, Rock" -> ["Pop", "Rock"]. */
    public static List<String> parseGenres(String genreStr) {
        if (genreStr == null || genreStr.isBlank()) {
            return List.of();
        }
        return java.util.Arrays.stream(genreStr.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .distinct()
                .toList();
    }

    /** "A ft. B & C" -> ["A", "B", "C"]. */
    public static List<String> parseArtists(String artistStr) {
        if (artistStr == null || artistStr.isBlank()) {
            return List.of();
        }
        return java.util.Arrays.stream(artistStr.split("[,/&]|\\b(?:ft|feat)(?:\\.|\\b)"))
                .map(s -> s.replaceAll("^[.\\s]+|[.\\s]+$", "").trim())
                .filter(s -> !s.isEmpty())
                .distinct()
                .toList();
    }

    /** Song se Recombee ke item values (Map) banao. */
    public Map<String, Object> buildSongValues(Song song) {
        Map<String, Object> values = new HashMap<>();
        values.put("title", song.getTitle());
        values.put("artistName", song.getArtistName());
        if (song.getArtistName() != null && !song.getArtistName().isBlank()) {
            List<String> artistsList = parseArtists(song.getArtistName());
            if (!artistsList.isEmpty()) {
                values.put("artists", artistsList);
            }
        }
        values.put("language", song.getLanguage());
        if (song.getGenre() != null && !song.getGenre().isBlank()) {
            String trimmedGenre = song.getGenre().trim();
            values.put("genre", trimmedGenre);
            List<String> genreList = parseGenres(trimmedGenre);
            if (!genreList.isEmpty()) {
                values.put("genres", genreList);
            }
        }
        if (song.getAlbum() != null && !song.getAlbum().isBlank()) {
            values.put("album", song.getAlbum());
        }
        values.put("country", song.getCountry() != null && !song.getCountry().isBlank() ? song.getCountry() : "India");
        if (song.getImageKey() != null && !song.getImageKey().isBlank()) {
            values.put("imageKey", song.getImageKey());
        }
        if (song.getSongKey() != null && !song.getSongKey().isBlank()) {
            values.put("songKey", song.getSongKey());
            values.put("audioKey", song.getSongKey());
        }
        if (song.getVideoKey() != null && !song.getVideoKey().isBlank()) {
            values.put("videoKey", song.getVideoKey());
            values.put("canvasKey", song.getVideoKey());
        }
        if (song.getFullVideoKey() != null && !song.getFullVideoKey().isBlank()) {
            values.put("fullVideoKey", song.getFullVideoKey());
        }
        if (song.getPreviewStartTime() != null) {
            values.put("previewStartTime", song.getPreviewStartTime());
        }
        if (song.getPreviewEndTime() != null) {
            values.put("previewEndTime", song.getPreviewEndTime());
        }
        values.put("isFeatured", song.getIsFeatured() != null ? song.getIsFeatured() : false);
        if (song.getLrclibId() != null && !song.getLrclibId().isBlank()) {
            values.put("lrclibId", song.getLrclibId());
        }
        if (song.getStatus() != null) {
            values.put("status", song.getStatus().name());
        }
        if (song.getJobId() != null && !song.getJobId().isBlank()) {
            values.put("jobId", song.getJobId());
        }
        if (song.getCreatedAt() != null) {
            values.put("createdAt", song.getCreatedAt().toString());
        }
        if (song.getDuration() != null && song.getDuration() > 0) {
            values.put("duration", song.getDuration());
        }
        Long totalStreams = (song.getSongMetadata() != null && song.getSongMetadata().getTotalStreams() != null)
                ? song.getSongMetadata().getTotalStreams()
                : 0L;
        int streams = (int) Math.min(totalStreams, Integer.MAX_VALUE);
        values.put("totalStreams", streams);
        return values;
    }

    /** Song Recombee me save/update karo (item na ho to ban jaata hai). */
    public void saveSong(Song song) throws Exception {
        Map<String, Object> values = buildSongValues(song);
        recombeeClient.send(withTimeout(new SetItemValues(song.getId(), values).setCascadeCreate(true)));
    }

    /** Sirf streams count update karo. */
    public void updateTotalStreams(String songId, long totalStreams) throws Exception {
        Map<String, Object> values = new HashMap<>();
        int streams = (int) Math.min(totalStreams, Integer.MAX_VALUE);
        values.put("totalStreams", streams);
        recombeeClient.send(withTimeout(new SetItemValues(songId, values).setCascadeCreate(true)));
    }

    /** Kam values ke saath song save (baaki null). */
    public void saveSong(String songId, String title, String artistName, String language, String genre) throws Exception {
        saveSong(songId, title, artistName, language, genre, null, null, null, 0L);
    }

    /** Kam values ke saath song save. */
    public void saveSong(String songId, String title, String artistName, String language, String genre, Integer duration) throws Exception {
        saveSong(songId, title, artistName, language, genre, null, null, duration, 0L);
    }

    /** Saari values ke saath song save. */
    public void saveSong(String songId, String title, String artistName, String language, String genre, String album, String country, String imageKey, Integer duration, Long totalStreams) throws Exception {
        Map<String, Object> values = new HashMap<>();
        values.put("title", title);
        values.put("artistName", artistName);
        if (artistName != null && !artistName.isBlank()) {
            List<String> artistsList = parseArtists(artistName);
            if (!artistsList.isEmpty()) {
                values.put("artists", artistsList);
            }
        }
        values.put("language", language);
        if (genre != null && !genre.isBlank()) {
            String trimmedGenre = genre.trim();
            values.put("genre", trimmedGenre);
            List<String> genreList = parseGenres(trimmedGenre);
            if (!genreList.isEmpty()) {
                values.put("genres", genreList);
            }
        }
        if (album != null && !album.isBlank()) {
            values.put("album", album);
        }
        values.put("country", country != null && !country.isBlank() ? country : "India");
        if (imageKey != null && !imageKey.isBlank()) {
            values.put("imageKey", imageKey);
        }
        if (duration != null && duration > 0) {
            values.put("duration", duration);
        }
        if (totalStreams != null && totalStreams >= 0) {
            values.put("totalStreams", (int) Math.min(totalStreams, Integer.MAX_VALUE));
        }
        recombeeClient.send(withTimeout(new SetItemValues(songId, values).setCascadeCreate(true)));
    }

    /** Bina country ke song save. */
    public void saveSong(String songId, String title, String artistName, String language, String genre, String album, String imageKey, Integer duration, Long totalStreams) throws Exception {
        saveSong(songId, title, artistName, language, genre, album, "India", imageKey, duration, totalStreams);
    }

    /** Song Recombee se hatao. */
    public void delete(String songId) throws Exception {
        recombeeClient.send(withTimeout(new DeleteItem(songId)));
    }

    /** Naya user Recombee me banao. */
    public void addUser(String userId) throws Exception {
        recombeeClient.send(withTimeout(new AddUser(userId)));
    }

    /** User Recombee se hatao. */
    public void deleteUser(String userId) throws Exception {
        recombeeClient.send(withTimeout(new DeleteUser(userId)));
    }

    // ── User ke actions (ratings / bookmarks) bhejna ──

    // percentage: 0.0 - 1.0 (0.87 = gaane ka 87% suna). Upar table ke hisaab se rating banti hai.
    public void trackPlay(String userId, String songId, double percentage) throws Exception {
        double rating;
        if (percentage >= 0.90) {
            rating = 0.7; // poora suna - strong positive
        } else if (percentage >= 0.50) {
            rating = 0.3; // achha khaasa suna - moderate positive
        } else if (percentage >= 0.25) {
            rating = 0.1; // thoda suna - weak positive
        } else {
            rating = -0.3; // jaldi chhod diya - halka negative
        }
        recombeeClient.send(withTimeout(new AddRating(userId, songId, rating).setCascadeCreate(true)));
    }

    // Skip button dabaya: -1.0 (sabse strong negative)
    public void trackSkip(String userId, String songId) throws Exception {
        recombeeClient.send(withTimeout(new AddRating(userId, songId, -1.0).setCascadeCreate(true)));
    }

    // Search karke play kiya - user ne khud dhoondha, strong positive
    public void trackSearchPlay(String userId, String songId) throws Exception {
        recombeeClient.send(withTimeout(new AddDetailView(userId, songId).setCascadeCreate(true)));
    }

    // Khud queue me joda - strong intent
    public void trackQueueAdd(String userId, String songId) throws Exception {
        recombeeClient.send(withTimeout(new AddBookmark(userId, songId).setCascadeCreate(true)));
    }

    // Queue se hataya - negative intent
    public void trackQueueRemove(String userId, String songId) throws Exception {
        try {
            recombeeClient.send(withTimeout(new DeleteBookmark(userId, songId)));
        } catch (Exception ignored) {
            // Radio/playlist se queue hua tha to bookmark tha hi nahi - error ignore
        }
        recombeeClient.send(withTimeout(new AddRating(userId, songId, -0.4).setCascadeCreate(true)));
    }

    // Favourite me joda: +1.0
    public void trackFavouriteAdd(String userId, String songId) throws Exception {
        recombeeClient.send(withTimeout(new AddRating(userId, songId, 1.0).setCascadeCreate(true)));
    }

    // Favourite se hataya: -0.5
    public void trackFavouriteRemove(String userId, String songId) throws Exception {
        recombeeClient.send(withTimeout(new AddRating(userId, songId, -0.5).setCascadeCreate(true)));
    }

    // Apni playlist me joda: +0.8
    public void trackPlaylistAdd(String userId, String songId) throws Exception {
        recombeeClient.send(withTimeout(new AddRating(userId, songId, 0.8).setCascadeCreate(true)));
    }

    // Apni playlist se hataya: -0.4
    public void trackPlaylistRemove(String userId, String songId) throws Exception {
        recombeeClient.send(withTimeout(new AddRating(userId, songId, -0.4).setCascadeCreate(true)));
    }

    // Dislike / chhupaya - strong negative
    public void trackDislike(String userId, String songId) throws Exception {
        recombeeClient.send(withTimeout(new AddRating(userId, songId, -1.0).setCascadeCreate(true)));
    }

    // Share kiya - user ko bahut pasand hai
    public void trackShare(String userId, String songId) throws Exception {
        recombeeClient.send(withTimeout(new AddRating(userId, songId, 0.6).setCascadeCreate(true)));
    }

    // Artist follow kiya (Recombee me user-artist ka signal)
    public void trackArtistFollow(String userId, String artistId) throws Exception {
        recombeeClient.send(withTimeout(new AddRating(userId, artistId, 1.0).setCascadeCreate(true)));
    }

    // Artist unfollow kiya
    public void trackArtistUnfollow(String userId, String artistId) throws Exception {
        recombeeClient.send(withTimeout(new AddRating(userId, artistId, -0.5).setCascadeCreate(true)));
    }

    // Seedhi rating bhejo (jaise baar baar sune gaanon ka strong positive)
    public void trackRating(String userId, String songId, double rating) throws Exception {
        recombeeClient.send(withTimeout(new AddRating(userId, songId, rating).setCascadeCreate(true)));
    }

    // Gaane ka detail page / preview dekha (halka signal)
    public void trackDetailView(String userId, String songId) throws Exception {
        recombeeClient.send(withTimeout(new AddDetailView(userId, songId).setCascadeCreate(true)));
    }

    // ── Recommendations lena (zyadatar sirf ids; details caller DB se laata hai) ──

    /** User ke liye song ids. */
    public List<String> recommendForUser(String userId, int count) throws Exception {
        return new ArrayList<>(recommendForUserWithAudio(userId, count).keySet());
    }

    /**
     * User ke liye recommendations, Recombee ke order me, har song id ke saath uske audio features
     * (na hon to null). Recombee se sirf audio properties maangte hain (response chhota rahe).
     */
    public Map<String, AudioProfile> recommendForUserWithAudio(String userId, int count) throws Exception {
        RecommendationResponse response;
        try {
            response = recombeeClient.send(
                    withTimeout(new RecommendItemsToUser(userId, count)
                            .setCascadeCreate(true)
                            .setReturnProperties(true)
                            .setIncludedProperties(AudioProfile.PROPERTY_NAMES)
                            .setBooster(TOTAL_STREAMS_BOOSTER)));
        } catch (Exception e) {
            log.warn("Recombee recommendForUser with booster failed, retrying without booster: {}", e.getMessage());
            response = recombeeClient.send(
                    withTimeout(new RecommendItemsToUser(userId, count)
                            .setCascadeCreate(true)
                            .setReturnProperties(true)
                            .setIncludedProperties(AudioProfile.PROPERTY_NAMES)));
        }
        Map<String, AudioProfile> result = new java.util.LinkedHashMap<>();
        if (response != null) {
            for (Recommendation hit : response) {
                if (hit != null && hit.getId() != null) {
                    result.putIfAbsent(hit.getId(), AudioProfile.fromValues(hit.getValues()));
                }
            }
        }
        return result;
    }

    /**
     * Recombee se ek gaane ke audio features. Koshish bhar: gaana na ho, data na ho, ya call fail ho to null.
     */
    public AudioProfile getAudioProfile(String songId) {
        if (songId == null || songId.isBlank()) return null;
        try {
            return AudioProfile.fromValues(recombeeClient.send(withTimeout(new GetItemValues(songId))));
        } catch (Exception e) {
            log.debug("Recombee audio profile lookup failed for {}: {}", songId, e.getMessage());
            return null;
        }
    }

    /** Recombee ke result (values ke saath) se SongDto banao. */
    public SongDto mapHitToSongDto(Recommendation hit) {
        if (hit == null || hit.getId() == null) return null;
        String id = hit.getId();
        Map<String, Object> values = hit.getValues();
        if (values == null) {
            values = Map.of();
        }

        String title = (String) values.get("title");
        String artistName = (String) values.get("artistName");
        if ((artistName == null || artistName.isBlank()) && values.get("artists") instanceof List<?> list && !list.isEmpty()) {
            artistName = list.stream().map(Object::toString).collect(java.util.stream.Collectors.joining(", "));
        }
        Integer duration = values.get("duration") instanceof Number n ? n.intValue() : null;
        String songKey = (String) values.get("songKey");
        String imageKey = (String) values.get("imageKey");
        String videoKey = (String) values.get("videoKey");
        String fullVideoKey = (String) values.get("fullVideoKey");
        Integer previewStartTime = values.get("previewStartTime") instanceof Number n ? n.intValue() : null;
        Integer previewEndTime = values.get("previewEndTime") instanceof Number n ? n.intValue() : null;
        Boolean isFeatured = values.get("isFeatured") instanceof Boolean b ? b : false;
        String language = (String) values.get("language");
        String genre = (String) values.get("genre");
        if ((genre == null || genre.isBlank()) && values.get("genres") instanceof List<?> list && !list.isEmpty()) {
            genre = list.stream().map(Object::toString).collect(java.util.stream.Collectors.joining(", "));
        }
        String album = (String) values.get("album");
        String country = values.get("country") instanceof String c && !c.isBlank() ? c : "India";
        String lrclibId = (String) values.get("lrclibId");

        StatusEnum status = null;
        if (values.get("status") instanceof String s) {
            try { status = StatusEnum.valueOf(s); } catch (Exception ignored) {}
        }
        String jobId = (String) values.get("jobId");
        Long totalStreams = values.get("totalStreams") instanceof Number n ? n.longValue() : 0L;

        LocalDateTime createdAt = null;
        if (values.get("createdAt") instanceof String s) {
            try { createdAt = LocalDateTime.parse(s); } catch (Exception ignored) {}
        }

        Double tempo = values.get("tempo") instanceof Number n ? n.doubleValue() : null;
        Double energy = values.get("energy") instanceof Number n ? n.doubleValue() : null;
        Double valence = values.get("valence") instanceof Number n ? n.doubleValue() : null;
        Double danceability = values.get("danceability") instanceof Number n ? n.doubleValue() : null;

        return new SongDto(
            id, title, artistName, duration, songKey, imageKey,
            videoKey, fullVideoKey, previewStartTime, previewEndTime,
            isFeatured, language, genre, album, country, lrclibId,
            status, jobId, totalStreams, createdAt,
            tempo, energy, valence, danceability
        );
    }

    /** Seed gaane se radio (poori details ke saath), excludeIds chhod ke. */
    public List<SongDto> recommendRadioDetailed(String seedSongId, List<String> excludeIds, int count) throws Exception {
        java.util.Set<String> excludedSet = new java.util.HashSet<>();
        if (excludeIds != null) {
            for (String id : excludeIds) {
                if (id != null && !id.isBlank()) excludedSet.add(id.trim());
            }
        }
        if (seedSongId != null) {
            excludedSet.add(seedSongId.trim());
        }

        int fetchCount = Math.max(count * 2, 20);
        RecommendationResponse response;
        try {
            response = recombeeClient.send(
                    withTimeout(new RecommendItemsToItem(seedSongId, null, fetchCount)
                            .setReturnProperties(true)
                            .setBooster(TOTAL_STREAMS_BOOSTER)));
        } catch (Exception e) {
            log.warn("Recombee recommendRadioDetailed with booster failed, retrying without booster: {}", e.getMessage());
            response = recombeeClient.send(
                    withTimeout(new RecommendItemsToItem(seedSongId, null, fetchCount)
                            .setReturnProperties(true)));
        }

        List<SongDto> result = new ArrayList<>();
        for (Recommendation hit : response) {
            if (hit != null && hit.getId() != null && !excludedSet.contains(hit.getId())) {
                SongDto dto = mapHitToSongDto(hit);
                if (dto != null && (dto.status() == null || dto.status() == StatusEnum.ACTIVE)) {
                    result.add(dto);
                    excludedSet.add(hit.getId());
                    if (result.size() >= count) break;
                }
            }
        }
        return result;
    }

    /**
     * Radio recommendations + Recombee ka recommId. Ye recommId recommendNextItems() ko dene se
     * agle gaane pichle batch ke aage se aate hain (session yaad rehta hai).
     */
    public RadioResponseDto recommendRadioWithRecommId(String seedSongId, List<String> excludeIds, int count) throws Exception {
        java.util.Set<String> excludedSet = new java.util.HashSet<>();
        if (excludeIds != null) {
            for (String id : excludeIds) {
                if (id != null && !id.isBlank()) excludedSet.add(id.trim());
            }
        }
        if (seedSongId != null) excludedSet.add(seedSongId.trim());

        int fetchCount = Math.max(count * 2, 20);
        RecommendationResponse response;
        try {
            response = recombeeClient.send(
                    withTimeout(new RecommendItemsToItem(seedSongId, null, fetchCount)
                            .setReturnProperties(true)
                            .setBooster(TOTAL_STREAMS_BOOSTER)));
        } catch (Exception e) {
            log.warn("Recombee recommendRadioWithRecommId booster failed, retrying: {}", e.getMessage());
            response = recombeeClient.send(
                    withTimeout(new RecommendItemsToItem(seedSongId, null, fetchCount)
                            .setReturnProperties(true)));
        }

        String recommId = response != null ? response.getRecommId() : null;
        List<SongDto> result = new ArrayList<>();
        if (response != null) {
            for (Recommendation hit : response) {
                if (hit != null && hit.getId() != null && !excludedSet.contains(hit.getId())) {
                    SongDto dto = mapHitToSongDto(hit);
                    if (dto != null && (dto.status() == null || dto.status() == StatusEnum.ACTIVE)) {
                        result.add(dto);
                        excludedSet.add(hit.getId());
                        if (result.size() >= count) break;
                    }
                }
            }
        }
        return new RadioResponseDto(result, recommId);
    }

    /** Similar gaane, poori details ke saath. */
    public List<SongDto> recommendSimilarDetailed(String songId, int count) throws Exception {
        RecommendationResponse response;
        try {
            response = recombeeClient.send(
                    withTimeout(new RecommendItemsToItem(songId, null, count)
                            .setReturnProperties(true)
                            .setBooster(TOTAL_STREAMS_BOOSTER)));
        } catch (Exception e) {
            log.warn("Recombee recommendSimilarDetailed with booster failed, retrying without booster: {}", e.getMessage());
            response = recombeeClient.send(
                    withTimeout(new RecommendItemsToItem(songId, null, count)
                            .setReturnProperties(true)));
        }

        List<SongDto> result = new ArrayList<>();
        for (Recommendation hit : response) {
            if (hit != null && hit.getId() != null) {
                SongDto dto = mapHitToSongDto(hit);
                if (dto != null && (dto.status() == null || dto.status() == StatusEnum.ACTIVE)) {
                    result.add(dto);
                }
            }
        }
        return result;
    }

    /** Similar gaano ki ids. */
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
     * "Ab aage kya bajaayein" - Recombee ka RecommendNextItems, jo user ke abhi ke sequence ko dhyan me
     * rakhta hai; isse auto-play ke gaane ek doosre se behtar jude lagte hain.
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

    // ── Saare songs ek saath dobara bhejna ──

    /** Saare songs ek batch me Recombee ko bhejo. */
    public void reindexAll(List<Song> songs) throws Exception {
        ArrayList<Request> requests = new ArrayList<>();
        for (Song song : songs) {
            Map<String, Object> values = buildSongValues(song);
            requests.add(withTimeout(new SetItemValues(song.getId(), values).setCascadeCreate(true)));
        }
        if (!requests.isEmpty()) {
            recombeeClient.send(withTimeout(new Batch(requests)));
        }
        log.info("Reindexed {} songs in Recombee", songs.size());
    }
}
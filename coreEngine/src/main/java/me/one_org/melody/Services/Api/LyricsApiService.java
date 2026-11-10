package me.one_org.melody.Services.Api;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.regex.Pattern;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Dto.Controllers.Api.LyricsDto;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Exceptions.ResourceNotFoundException;
import me.one_org.melody.Repository.SongsRepository;

@Service
@Transactional(readOnly = true)
@Slf4j
public class LyricsApiService {

    private static final String REDIS_PREFIX = "lyrics:";
    private static final String LRCLIB_BASE_URL = "https://lrclib.net/api";
    private static final String USER_AGENT = "AudioMelody/1.0 (https://audiomelody.me)";

    private static final Pattern CLEAN_PATTERN = Pattern.compile(
            "\\s*[\\[\\(](?:official|audio|video|lyrics?|remaster(?:ed)?|from\\s+[\"'].*?[\"']|version|feat\\.?|ft\\.?).*?[\\]\\)]",
            Pattern.CASE_INSENSITIVE
    );

    private final SongsRepository songsRepository;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @org.springframework.beans.factory.annotation.Autowired
    public LyricsApiService(
            SongsRepository songsRepository,
            @org.springframework.beans.factory.annotation.Autowired(required = false) StringRedisTemplate redisTemplate,
            @org.springframework.beans.factory.annotation.Autowired(required = false) ObjectMapper objectMapper
    ) {
        this.songsRepository = songsRepository;
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper != null ? objectMapper : new ObjectMapper();
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    public LyricsDto getLyrics(String songId) {
        if (songId == null || songId.isBlank()) {
            throw new IllegalArgumentException("Song ID cannot be empty");
        }

        String cacheKey = REDIS_PREFIX + songId.trim();

        // 1. Check Redis cache first
        try {
            if (redisTemplate != null) {
                String cachedJson = redisTemplate.opsForValue().get(cacheKey);
                if (cachedJson != null && !cachedJson.isBlank()) {
                    return objectMapper.readValue(cachedJson, LyricsDto.class);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to read lyrics from Redis for song [{}]: {}", songId, e.getMessage());
        }

        // 2. Fetch song from database
        Song song = songsRepository.findById(songId.trim())
                .orElseThrow(() -> new ResourceNotFoundException("Song not found with id: " + songId));

        // 3. Query LRCLIB
        LyricsDto lyrics = fetchFromLrclib(song);

        // 4. Cache in Redis
        try {
            if (redisTemplate != null) {
                String json = objectMapper.writeValueAsString(lyrics);
                boolean hasContent = lyrics.syncedLyrics() != null || lyrics.plainLyrics() != null;
                Duration ttl = hasContent ? Duration.ofDays(30) : Duration.ofHours(6);
                redisTemplate.opsForValue().set(cacheKey, json, ttl);
            }
        } catch (Exception e) {
            log.warn("Failed to cache lyrics in Redis for song [{}]: {}", songId, e.getMessage());
        }

        return lyrics;
    }

    private LyricsDto fetchFromLrclib(Song song) {
        // Attempt 1: Fetch by lrclibId if present
        if (song.getLrclibId() != null && !song.getLrclibId().isBlank()) {
            try {
                String url = LRCLIB_BASE_URL + "/get/" + URLEncoder.encode(song.getLrclibId().trim(), StandardCharsets.UTF_8);
                LyricsDto dto = executeLrclibRequest(url, song.getId());
                if (dto != null) return dto;
            } catch (Exception e) {
                log.debug("LRCLIB direct ID lookup failed for song [{}]: {}", song.getId(), e.getMessage());
            }
        }

        // Attempt 2: Search by track_name and artist_name
        try {
            String cleanTitle = cleanString(song.getTitle());
            String cleanArtist = cleanString(song.getArtistName());

            StringBuilder sb = new StringBuilder(LRCLIB_BASE_URL)
                    .append("/get?track_name=")
                    .append(URLEncoder.encode(cleanTitle, StandardCharsets.UTF_8))
                    .append("&artist_name=")
                    .append(URLEncoder.encode(cleanArtist, StandardCharsets.UTF_8));

            if (song.getDuration() != null && song.getDuration() > 0) {
                sb.append("&duration=").append(song.getDuration());
            }

            LyricsDto dto = executeLrclibRequest(sb.toString(), song.getId());
            if (dto != null) return dto;
        } catch (Exception e) {
            log.debug("LRCLIB query lookup failed for song [{}]: {}", song.getId(), e.getMessage());
        }

        // Fallback: empty LyricsDto
        return new LyricsDto(
                song.getId(),
                song.getLrclibId(),
                song.getTitle(),
                song.getArtistName(),
                song.getDuration() != null ? song.getDuration().doubleValue() : null,
                false,
                null,
                null
        );
    }

    private LyricsDto executeLrclibRequest(String urlStr, String songId) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(urlStr))
                    .header("User-Agent", USER_AGENT)
                    .header("Accept", "application/json")
                    .timeout(Duration.ofSeconds(4))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200 && response.body() != null && !response.body().isBlank()) {
                JsonNode root = objectMapper.readTree(response.body());
                String id = root.hasNonNull("id") ? root.get("id").asText() : null;
                String trackName = root.hasNonNull("trackName") ? root.get("trackName").asText() : null;
                String artistName = root.hasNonNull("artistName") ? root.get("artistName").asText() : null;
                Double duration = root.hasNonNull("duration") ? root.get("duration").asDouble() : null;
                Boolean instrumental = root.hasNonNull("instrumental") ? root.get("instrumental").asBoolean() : false;
                String plainLyrics = root.hasNonNull("plainLyrics") ? root.get("plainLyrics").asText() : null;
                String syncedLyrics = root.hasNonNull("syncedLyrics") ? root.get("syncedLyrics").asText() : null;

                return new LyricsDto(
                        songId,
                        id,
                        trackName,
                        artistName,
                        duration,
                        instrumental,
                        plainLyrics,
                        syncedLyrics
                );
            }
        } catch (Exception e) {
            log.warn("Error calling LRCLIB at [{}]: {}", urlStr, e.getMessage());
        }
        return null;
    }

    private static String cleanString(String text) {
        if (text == null) return "";
        String cleaned = CLEAN_PATTERN.matcher(text).replaceAll("").trim();
        return cleaned.isEmpty() ? text.trim() : cleaned;
    }
}


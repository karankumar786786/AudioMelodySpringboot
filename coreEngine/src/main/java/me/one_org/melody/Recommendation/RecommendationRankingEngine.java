package me.one_org.melody.Recommendation;

import java.util.*;
import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Enums.StatusEnum;

/**
 * Intelligent recommendation ranking engine that prioritizes musical vibe,
 * genre affinity, language compatibility, and streaming momentum while strictly
 * enforcing artist diversity (capping max tracks per artist) so users discover
 * diverse music instead of repetitive songs from the same artist.
 */
@Component
@Slf4j
public class RecommendationRankingEngine {

    public static final int DEFAULT_MAX_PER_ARTIST = 2;
    public static final int DEFAULT_MAX_PER_ALBUM = 2;

    public static record ScoredCandidate(SongDto song, double score) {}

    /**
     * Ranks and diversifies candidate songs against a seed song.
     *
     * @param seedSong The reference seed song (can be null for user/home feed)
     * @param recombeeCandidates Candidates returned from Recombee AI
     * @param dbCandidates Candidates fetched from PostgreSQL
     * @param excludedIds IDs to exclude (already in queue, history, disliked)
     * @param targetCount Number of songs to return
     * @param maxPerArtist Max songs allowed per artist in final output
     * @param maxPerAlbum Max songs allowed per album in final output
     */
    public List<SongDto> rankAndDiversify(
            Song seedSong,
            List<SongDto> recombeeCandidates,
            List<Song> dbCandidates,
            Set<String> excludedIds,
            int targetCount,
            int maxPerArtist,
            int maxPerAlbum) {

        Set<String> excludes = new HashSet<>();
        if (excludedIds != null) {
            for (String ex : excludedIds) {
                if (ex != null && !ex.isBlank()) excludes.add(ex.trim());
            }
        }
        if (seedSong != null && seedSong.getId() != null) {
            excludes.add(seedSong.getId().trim());
        }

        // Map Recombee candidates with their rank positions (0-indexed)
        Map<String, Integer> recombeeRankMap = new HashMap<>();
        Map<String, SongDto> candidatePool = new LinkedHashMap<>();

        if (recombeeCandidates != null) {
            for (int i = 0; i < recombeeCandidates.size(); i++) {
                SongDto dto = recombeeCandidates.get(i);
                if (dto != null && dto.id() != null && !excludes.contains(dto.id())) {
                    if (dto.status() == null || dto.status() == StatusEnum.ACTIVE) {
                        recombeeRankMap.put(dto.id(), i);
                        candidatePool.put(dto.id(), dto);
                    }
                }
            }
        }

        if (dbCandidates != null) {
            for (Song s : dbCandidates) {
                if (s != null && s.getId() != null && !excludes.contains(s.getId())) {
                    if (s.getStatus() == null || s.getStatus() == StatusEnum.ACTIVE) {
                        candidatePool.putIfAbsent(s.getId(), SongDto.fromEntity(s));
                    }
                }
            }
        }

        if (candidatePool.isEmpty()) {
            return List.of();
        }

        // 1. Score every candidate
        List<ScoredCandidate> scoredList = new ArrayList<>(candidatePool.size());
        for (SongDto candidate : candidatePool.values()) {
            double score = scoreCandidate(candidate, seedSong, recombeeRankMap.get(candidate.id()));
            scoredList.add(new ScoredCandidate(candidate, score));
        }

        // Sort candidates descending by score
        scoredList.sort((a, b) -> Double.compare(b.score(), a.score()));

        // 2. Diversity Selection Phase: Enforce artist and album quotas
        List<SongDto> selected = new ArrayList<>(Math.min(targetCount, scoredList.size()));
        List<ScoredCandidate> deferredDueToQuotas = new ArrayList<>();

        Map<String, Integer> artistCount = new HashMap<>();
        Map<String, Integer> albumCount = new HashMap<>();

        for (ScoredCandidate item : scoredList) {
            if (selected.size() >= targetCount) {
                break;
            }

            SongDto song = item.song();
            String primaryArtist = getPrimaryArtistKey(song.artistName());
            String albumKey = getNormalizedKey(song.album());

            int currentArtistCount = artistCount.getOrDefault(primaryArtist, 0);
            int currentAlbumCount = (albumKey != null) ? albumCount.getOrDefault(albumKey, 0) : 0;

            boolean artistLimitReached = currentArtistCount >= maxPerArtist;
            boolean albumLimitReached = (albumKey != null) && (currentAlbumCount >= maxPerAlbum);

            if (artistLimitReached || albumLimitReached) {
                deferredDueToQuotas.add(item);
                continue;
            }

            selected.add(song);
            artistCount.put(primaryArtist, currentArtistCount + 1);
            if (albumKey != null) {
                albumCount.put(albumKey, currentAlbumCount + 1);
            }
        }

        // 3. Fallback: If quotas prevented filling targetCount, relax quotas with remaining candidates
        if (selected.size() < targetCount && !deferredDueToQuotas.isEmpty()) {
            for (ScoredCandidate item : deferredDueToQuotas) {
                if (selected.size() >= targetCount) break;
                selected.add(item.song());
            }
        }

        log.debug("RecommendationRankingEngine selected {} diverse songs (target {}) from pool of {}",
                selected.size(), targetCount, candidatePool.size());

        return selected;
    }

    public List<SongDto> rankAndDiversify(
            Song seedSong,
            List<SongDto> recombeeCandidates,
            List<Song> dbCandidates,
            Set<String> excludedIds,
            int targetCount) {
        return rankAndDiversify(
                seedSong,
                recombeeCandidates,
                dbCandidates,
                excludedIds,
                targetCount,
                DEFAULT_MAX_PER_ARTIST,
                DEFAULT_MAX_PER_ALBUM
        );
    }

    public static Set<String> parseGenreSet(String genreStr) {
        if (genreStr == null || genreStr.isBlank()) {
            return Collections.emptySet();
        }
        Set<String> set = new LinkedHashSet<>();
        for (String part : genreStr.split(",")) {
            String trimmed = part.trim().toLowerCase();
            if (!trimmed.isEmpty()) {
                set.add(trimmed);
            }
        }
        return set;
    }

    /**
     * Multi-factor scoring model that prioritizes musical genre, mood, and language over artist duplication.
     */
    public double scoreCandidate(SongDto candidate, Song seedSong, Integer recombeeRank) {
        double score = 0.0;

        // If no seed song provided (e.g. general / user recommendation), score by Recombee & popularity
        if (seedSong == null) {
            if (recombeeRank != null) {
                score += Math.max(10.0, 50.0 - (recombeeRank * 2.0));
            }
            score += computeStreamBoost(candidate.totalStreams());
            return score;
        }

        Set<String> seedGenres = parseGenreSet(seedSong.getGenre());
        Set<String> candGenres = parseGenreSet(candidate.genre());

        String seedLang = getNormalizedKey(seedSong.getLanguage());
        String candLang = getNormalizedKey(candidate.language());

        String seedArtist = getNormalizedKey(seedSong.getArtistName());
        String candArtist = getNormalizedKey(candidate.artistName());

        String seedAlbum = getNormalizedKey(seedSong.getAlbum());
        String candAlbum = getNormalizedKey(candidate.album());

        // 1. Genre Affinity (Highest Weight, up to 40 pts)
        // Multi-genre aware: handles comma-separated genres with exact set equality,
        // Jaccard token overlap for partial multi-genre matches, and subgenre substring matching.
        if (!seedGenres.isEmpty() && !candGenres.isEmpty()) {
            if (seedGenres.equals(candGenres)) {
                score += 40.0;
            } else {
                Set<String> intersection = new HashSet<>(seedGenres);
                intersection.retainAll(candGenres);

                if (!intersection.isEmpty()) {
                    // Shared exact genre tokens: award 25.0 base + up to 15.0 proportional to overlap
                    double jaccard = (double) intersection.size() / (seedGenres.size() + candGenres.size() - intersection.size());
                    score += 25.0 + (15.0 * jaccard);
                } else {
                    // Subgenre / partial overlap across tokens (e.g. "dance-pop" contains "pop" or "bollywood romantic" contains "romantic")
                    boolean subgenreMatch = false;
                    for (String sg : seedGenres) {
                        for (String cg : candGenres) {
                            if (sg.contains(cg) || cg.contains(sg)) {
                                subgenreMatch = true;
                                break;
                            }
                        }
                        if (subgenreMatch) break;
                    }
                    if (subgenreMatch) {
                        score += 20.0;
                    }
                }
            }
        }

        // 2. Language Affinity (High Weight, up to 20 pts)
        if (seedLang != null && candLang != null && seedLang.equals(candLang)) {
            score += 20.0;
        }

        // 3. Recombee Collaborative Signal (up to 30 pts)
        if (recombeeRank != null) {
            if (recombeeRank == 0) score += 30.0;
            else if (recombeeRank <= 2) score += 25.0;
            else if (recombeeRank <= 6) score += 20.0;
            else score += 15.0;
        }

        // 4. Artist Affinity (Controlled Weight, up to 15 pts)
        // Kept controlled so same artist does NOT dominate over genre + language + Recombee
        if (seedArtist != null && candArtist != null) {
            String seedPrimary = getPrimaryArtistKey(seedSong.getArtistName());
            String candPrimary = getPrimaryArtistKey(candidate.artistName());

            if (seedPrimary.equals(candPrimary)) {
                score += 15.0;
            } else if (candArtist.contains(seedPrimary) || seedArtist.contains(candPrimary)) {
                score += 8.0; // Collaborator / featuring match
            }
        }

        // 5. Album Affinity (Modest Weight, +10 pts)
        if (seedAlbum != null && candAlbum != null && seedAlbum.equals(candAlbum)) {
            score += 10.0;
        }

        // 6. Popularity & Streaming Momentum (up to 10 pts)
        score += computeStreamBoost(candidate.totalStreams());

        // 7. Freshness / Deterministic Jitter (0.0 to 3.0 pts)
        // Prevents static deterministic queue freezing across playbacks
        int hash = Math.abs((seedSong.getId() + "_" + candidate.id()).hashCode());
        double jitter = (hash % 100) / 33.3;
        score += jitter;

        return score;
    }

    private double computeStreamBoost(Long streams) {
        long s = streams != null ? streams : 0L;
        if (s > 10000) return 10.0;
        if (s > 1000) return 7.0;
        if (s > 100) return 4.0;
        if (s > 10) return 2.0;
        return 0.5;
    }

    public static String getPrimaryArtistKey(String artistName) {
        if (artistName == null || artistName.isBlank()) return "unknown";
        String cleaned = artistName.trim().toLowerCase();
        // Split on comma, slash, ampersand, or "ft."
        String[] parts = cleaned.split("[,/&]|\\bft\\.?|\\bfeat\\.?");
        if (parts.length > 0 && !parts[0].isBlank()) {
            return parts[0].trim();
        }
        return cleaned;
    }

    private static String getNormalizedKey(String str) {
        if (str == null || str.isBlank()) return null;
        return str.trim().toLowerCase();
    }
}


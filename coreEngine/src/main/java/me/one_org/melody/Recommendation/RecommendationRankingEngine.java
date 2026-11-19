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
        return rankAndDiversify(seedSong, null, recombeeCandidates, dbCandidates, excludedIds,
                targetCount, maxPerArtist, maxPerAlbum);
    }

    /**
     * Same as {@link #rankAndDiversify(Song, List, List, Set, int, int, int)} but also scores
     * candidates by audio-feature similarity to {@code seedAudio} (may be null).
     */
    public List<SongDto> rankAndDiversify(
            Song seedSong,
            AudioProfile seedAudio,
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
            double score = scoreCandidate(candidate, seedSong, seedAudio, recombeeRankMap.get(candidate.id()));
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
            Set<String> songArtists = parseArtistSet(song.artistName());
            String primaryArtist = getPrimaryArtistKey(song.artistName());
            String albumKey = getNormalizedKey(song.album());

            int currentAlbumCount = (albumKey != null) ? albumCount.getOrDefault(albumKey, 0) : 0;
            boolean albumLimitReached = (albumKey != null) && (currentAlbumCount >= maxPerAlbum);

            // Multi-artist quota check: verify none of the comma-separated artists exceeded maxPerArtist
            boolean artistLimitReached = false;
            for (String artistKey : songArtists) {
                if (artistCount.getOrDefault(artistKey, 0) >= maxPerArtist) {
                    artistLimitReached = true;
                    break;
                }
            }
            if (songArtists.isEmpty() && artistCount.getOrDefault(primaryArtist, 0) >= maxPerArtist) {
                artistLimitReached = true;
            }

            if (artistLimitReached || albumLimitReached) {
                deferredDueToQuotas.add(item);
                continue;
            }

            selected.add(song);
            for (String artistKey : songArtists) {
                artistCount.put(artistKey, artistCount.getOrDefault(artistKey, 0) + 1);
            }
            if (songArtists.isEmpty()) {
                artistCount.put(primaryArtist, artistCount.getOrDefault(primaryArtist, 0) + 1);
            }
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

    public List<SongDto> rankAndDiversify(
            Song seedSong,
            AudioProfile seedAudio,
            List<SongDto> recombeeCandidates,
            List<Song> dbCandidates,
            Set<String> excludedIds,
            int targetCount) {
        return rankAndDiversify(seedSong, seedAudio, recombeeCandidates, dbCandidates, excludedIds,
                targetCount, DEFAULT_MAX_PER_ARTIST, DEFAULT_MAX_PER_ALBUM);
    }

    /**
     * Builds a transient, never-persisted seed carrying only genres. Used for cold-start users
     * who picked genres during onboarding but have no listening history yet, so candidates are
     * scored by genre affinity instead of popularity alone.
     */
    /** True for a seed built by {@link #genreSeed(List)} (transient: no id, genres only). */
    public static boolean isGenreSeed(Song seed) {
        return seed != null && seed.getId() == null && seed.getTitle() == null && seed.getGenre() != null;
    }

    public static Song genreSeed(List<String> genres) {
        if (genres == null || genres.isEmpty()) return null;
        String joined = String.join(",", genres);
        if (joined.isBlank()) return null;
        Song seed = new Song();
        seed.setGenre(joined);
        return seed;
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

    public static Set<String> parseArtistSet(String artistName) {
        if (artistName == null || artistName.isBlank()) {
            return Collections.emptySet();
        }
        Set<String> set = new LinkedHashSet<>();
        String[] parts = artistName.split("[,/&]|\\b(?:ft|feat)(?:\\.|\\b)");
        for (String part : parts) {
            String trimmed = part.trim().toLowerCase().replaceAll("^[.\\s]+|[.\\s]+$", "");
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
        return scoreCandidate(candidate, seedSong, null, recombeeRank);
    }

    public double scoreCandidate(SongDto candidate, Song seedSong, AudioProfile seedAudio, Integer recombeeRank) {
        double score = 0.0;

        // If no seed song provided (e.g. general / user recommendation), score by Recombee & popularity
        if (seedSong == null) {
            if (recombeeRank != null) {
                score += Math.max(10.0, 50.0 - (recombeeRank * 2.0));
            }
            score += computeStreamBoost(candidate.totalStreams());
            // Audio-only seed (e.g. mood radio): how a track sounds is the main signal, so audio
            // affinity is doubled (up to 30 pts) to outweigh popularity (up to 10), plus jitter
            // so the same mood doesn't replay an identical queue.
            if (seedAudio != null && seedAudio.hasAny()) {
                score += AUDIO_ONLY_SEED_MULTIPLIER * scoreAudioFeatures(candidate, seedAudio);
                score += java.util.concurrent.ThreadLocalRandom.current().nextDouble(0.0, 3.0);
            }
            return score;
        }

        Set<String> seedGenres = parseGenreSet(seedSong.getGenre());
        Set<String> candGenres = parseGenreSet(candidate.genre());

        String seedLang = getNormalizedKey(seedSong.getLanguage());
        String candLang = getNormalizedKey(candidate.language());

        String seedAlbum = getNormalizedKey(seedSong.getAlbum());
        String candAlbum = getNormalizedKey(candidate.album());

        String seedCountry = getNormalizedKey(seedSong.getCountry());
        String candCountry = getNormalizedKey(candidate.country());

        // 1. Genre Affinity (Highest Weight, up to 40 pts)
        // Multi-genre aware: handles comma-separated genres with exact set equality,
        // Jaccard token overlap for partial multi-genre matches, and subgenre substring matching.
        // A genre seed is a set of picked genres (not one song's genres), so matching ANY
        // of them is a full match — Jaccard would penalise users for picking more genres.
        boolean genreSeed = isGenreSeed(seedSong);
        if (!seedGenres.isEmpty() && !candGenres.isEmpty()) {
            if (seedGenres.equals(candGenres)
                    || (genreSeed && !Collections.disjoint(seedGenres, candGenres))) {
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
        // Halved for genre seeds: a cold-start user has no interactions, so Recombee's picks are
        // popularity-driven and must not outweigh the genres the user explicitly chose.
        if (recombeeRank != null) {
            double recombeeScore;
            if (recombeeRank == 0) recombeeScore = 30.0;
            else if (recombeeRank <= 2) recombeeScore = 25.0;
            else if (recombeeRank <= 6) recombeeScore = 20.0;
            else recombeeScore = 15.0;
            score += genreSeed ? recombeeScore / 2 : recombeeScore;
        }

        // 4. Artist Affinity (Controlled Weight, up to 15 pts)
        // Multi-artist aware: handles comma-separated multiple artists (e.g. duos, collabs, features).
        // Kept controlled so same artist does NOT dominate over genre + language + Recombee
        Set<String> seedArtists = parseArtistSet(seedSong.getArtistName());
        Set<String> candArtists = parseArtistSet(candidate.artistName());

        if (!seedArtists.isEmpty() && !candArtists.isEmpty()) {
            String seedPrimary = getPrimaryArtistKey(seedSong.getArtistName());
            String candPrimary = getPrimaryArtistKey(candidate.artistName());

            if (seedArtists.equals(candArtists)) {
                score += 15.0; // All artists match (e.g. exact group / collabs)
            } else if (seedPrimary.equals(candPrimary)) {
                score += 15.0; // Primary lead artist matches
            } else {
                Set<String> sharedArtists = new HashSet<>(seedArtists);
                sharedArtists.retainAll(candArtists);
                if (!sharedArtists.isEmpty()) {
                    score += 10.0; // Shared collaborator / featured artist match
                } else {
                    boolean submatch = false;
                    for (String sa : seedArtists) {
                        for (String ca : candArtists) {
                            if (sa.contains(ca) || ca.contains(sa)) {
                                submatch = true;
                                break;
                            }
                        }
                        if (submatch) break;
                    }
                    if (submatch) {
                        score += 5.0;
                    }
                }
            }
        }

        // 5. Album Affinity (Modest Weight, +10 pts)
        if (seedAlbum != null && candAlbum != null && seedAlbum.equals(candAlbum)) {
            score += 10.0;
        }

        // 6. Country Affinity (Regional Relevance, +5 pts)
        if (seedCountry != null && candCountry != null && seedCountry.equals(candCountry)) {
            score += 5.0;
        }

        // 7. Popularity & Streaming Momentum (up to 10 pts)
        score += computeStreamBoost(candidate.totalStreams());

        // 8. Freshness / True Random Jitter (0.0 to 3.0 pts)
        // Prevents deterministic repeat queues — same seed produces fresh results each session
        double jitter = java.util.concurrent.ThreadLocalRandom.current().nextDouble(0.0, 3.0);
        score += jitter;

        // 9. Audio Feature Affinity — similarity to the seed's tempo, energy, valence, danceability (up to 15 pts)
        score += scoreAudioFeatures(candidate, seedAudio);

        return score;
    }

    static final double TEMPO_WEIGHT = 3.0;
    static final double FEATURE_WEIGHT = 4.0;
    /** BPM difference at which tempo similarity reaches zero. */
    static final double TEMPO_TOLERANCE = 40.0;
    /** 0..1 feature difference at which similarity reaches zero. */
    static final double FEATURE_TOLERANCE = 0.4;
    /** Share of a feature's weight given when the candidate's value is unknown. */
    static final double UNKNOWN_CREDIT = 0.5;
    /** Audio affinity multiplier when the seed is a bare {@link AudioProfile} (no seed song). */
    static final double AUDIO_ONLY_SEED_MULTIPLIER = 2.0;

    private double computeStreamBoost(Long streams) {
        if (streams == null || streams <= 0) return 0.0;
        // Smooth log10 curve: 10→1.6, 100→3.2, 1k→4.8, 10k→6.4, 1M→9.6, capped at 10 pts
        // Eliminates cliff-edge bucket jumps from previous hard thresholds
        double logStreams = Math.log10(streams + 1);
        return Math.min(10.0, logStreams * 1.6);
    }

    /**
     * P1: Audio feature affinity — how close the candidate sounds to the seed.
     * Tempo is worth up to 3 pts; energy, valence and danceability up to 4 pts each (15 max).
     * Each feature scores linearly from full weight (identical) to 0 (difference ≥ tolerance).
     * Features the seed lacks are skipped. Features the candidate lacks (songs not yet analysed,
     * since DB candidates now carry their stored features) get neutral half credit, so
     * candidates aren't favoured merely for having audio data.
     */
    double scoreAudioFeatures(SongDto candidate, AudioProfile seed) {
        if (candidate == null || seed == null || !seed.hasAny()) return 0.0;
        return featureScore(seed.tempo(), candidate.tempo(), TEMPO_TOLERANCE, TEMPO_WEIGHT)
                + featureScore(seed.energy(), candidate.energy(), FEATURE_TOLERANCE, FEATURE_WEIGHT)
                + featureScore(seed.valence(), candidate.valence(), FEATURE_TOLERANCE, FEATURE_WEIGHT)
                + featureScore(seed.danceability(), candidate.danceability(), FEATURE_TOLERANCE, FEATURE_WEIGHT);
    }

    private static double featureScore(Double seedValue, Double candValue, double tolerance, double weight) {
        if (seedValue == null) return 0.0;
        if (candValue == null) return weight * UNKNOWN_CREDIT;
        double similarity = Math.max(0.0, 1.0 - Math.abs(seedValue - candValue) / tolerance);
        return weight * similarity;
    }

    public static String getPrimaryArtistKey(String artistName) {
        if (artistName == null || artistName.isBlank()) return "unknown";
        String cleaned = artistName.trim().toLowerCase();
        // Split on comma, slash, ampersand, or "ft." / "feat."
        String[] parts = cleaned.split("[,/&]|\\b(?:ft|feat)(?:\\.|\\b)");
        if (parts.length > 0 && !parts[0].isBlank()) {
            return parts[0].replaceAll("^[.\\s]+|[.\\s]+$", "").trim();
        }
        return cleaned;
    }

    private static String getNormalizedKey(String str) {
        if (str == null || str.isBlank()) return null;
        return str.trim().toLowerCase();
    }
}


package me.one_org.melody.Services.Api;

import java.util.*;
import java.util.Comparator;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Dto.Controllers.Api.RadioResponseDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Entity.User;
import me.one_org.melody.Entity.UserHistory;
import me.one_org.melody.Enums.StatusEnum;
import me.one_org.melody.Recommendation.Recombee;
import me.one_org.melody.Recommendation.RecommendationRankingEngine;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Repository.UserHistoryRepository;
import me.one_org.melody.Repository.UsersRepository;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;

@Service
@Slf4j
@Transactional(readOnly = true)
public class RecommendationApiService {

    private final Recombee recombee;
    private final SongsRepository songsRepository;
    private final UserHistoryRepository userHistoryRepository;
    private final UsersRepository usersRepository;
    private final RecommendationRankingEngine rankingEngine;

    // P6: cold-start genre preferences
    private final UserGenrePreferenceService genrePreferenceService;

    // P9: Micrometer observability counters
    private final Counter recServCounter;
    private final Counter recFallbackCounter;
    private final Counter recColdStartCounter;

    @Autowired
    public RecommendationApiService(
            Recombee recombee,
            @Autowired(required = false) SongsRepository songsRepository,
            @Autowired(required = false) UserHistoryRepository userHistoryRepository,
            @Autowired(required = false) UsersRepository usersRepository,
            @Autowired(required = false) RecommendationRankingEngine rankingEngine,
            @Autowired(required = false) UserGenrePreferenceService genrePreferenceService,
            @Autowired(required = false) MeterRegistry meterRegistry) {
        this.recombee = recombee;
        this.songsRepository = songsRepository;
        this.userHistoryRepository = userHistoryRepository;
        this.usersRepository = usersRepository;
        this.rankingEngine = (rankingEngine != null) ? rankingEngine : new RecommendationRankingEngine();
        this.genrePreferenceService = genrePreferenceService;
        // P9: safe no-op counters when MeterRegistry is absent (e.g. in tests)
        if (meterRegistry != null) {
            this.recServCounter    = meterRegistry.counter("recommendations.served",   "source", "recombee");
            this.recFallbackCounter= meterRegistry.counter("recommendations.served",   "source", "fallback");
            this.recColdStartCounter=meterRegistry.counter("recommendations.cold_start","source","genre_prefs");
        } else {
            io.micrometer.core.instrument.simple.SimpleMeterRegistry noOpReg =
                    new io.micrometer.core.instrument.simple.SimpleMeterRegistry();
            this.recServCounter     = noOpReg.counter("recommendations.served",    "source", "recombee");
            this.recFallbackCounter = noOpReg.counter("recommendations.served",    "source", "fallback");
            this.recColdStartCounter= noOpReg.counter("recommendations.cold_start","source", "genre_prefs");
        }
    }

    public RecommendationApiService(Recombee recombee) {
        this(recombee, null, null, null, null, null, null);
    }

    public RecommendationApiService(Recombee recombee, SongsRepository songsRepository) {
        this(recombee, songsRepository, null, null, null, null, null);
    }

    public RecommendationApiService(
            Recombee recombee,
            SongsRepository songsRepository,
            UserHistoryRepository userHistoryRepository,
            UsersRepository usersRepository,
            RecommendationRankingEngine rankingEngine) {
        this(recombee, songsRepository, userHistoryRepository, usersRepository, rankingEngine, null, null);
    }

    public List<SongDto> recommendSimilar(String songId, int count) {
        return recommendRadio(songId, List.of(), count);
    }

    public List<SongDto> recommendRadio(String seedSongId, List<String> excludeIds, int count) {
        Song seedSong = null;
        if (songsRepository != null && seedSongId != null && !seedSongId.isBlank()) {
            seedSong = songsRepository.findById(seedSongId).orElse(null);
        }

        // 1. Gather Recombee AI candidate recommendations (oversampling count for diversity filtering)
        List<SongDto> recombeeHits = List.of();
        if (seedSongId != null && !seedSongId.isBlank()) {
            try {
                recombeeHits = recombee.recommendRadioDetailed(seedSongId, excludeIds, Math.max(count * 3, 20));
            } catch (Exception e) {
                log.warn("Recombee radio recommendation failed for seed {}: {}", seedSongId, e.getMessage());
            }
        }

        // 2. Gather Database candidate songs across genre, language, artist, and album
        List<Song> dbCandidates = getDatabaseCandidates(seedSong, seedSongId);

        // 3. Prepare exclusions (exclude seed song and client excludeIds)
        Set<String> excludes = new HashSet<>();
        if (excludeIds != null) {
            excludes.addAll(excludeIds);
        }
        if (seedSongId != null) {
            excludes.add(seedSongId);
        }

        // 4. Rank, score, and enforce artist & album diversity constraints
        List<SongDto> diverseRecommendations = rankingEngine.rankAndDiversify(
                seedSong,
                recombeeHits,
                dbCandidates,
                excludes,
                count
        );

        if (!diverseRecommendations.isEmpty()) {
            return diverseRecommendations;
        }

        // 5. Fallback: Catalog active songs if candidate pool was completely empty
        return fallbackCatalog(count);
    }

    public RadioResponseDto recommendRadioSession(String seedSongId, List<String> excludeIds, int count) {
        Song seedSong = null;
        if (songsRepository != null && seedSongId != null && !seedSongId.isBlank()) {
            seedSong = songsRepository.findById(seedSongId).orElse(null);
        }

        RadioResponseDto recombeeResult = null;
        if (seedSongId != null && !seedSongId.isBlank()) {
            try {
                recombeeResult = recombee.recommendRadioWithRecommId(seedSongId, excludeIds, Math.max(count * 3, 20));
            } catch (Exception e) {
                log.warn("Recombee radio session failed for seed {}: {}", seedSongId, e.getMessage());
            }
        }

        List<SongDto> recombeeSongs = recombeeResult != null ? recombeeResult.songs() : List.of();
        String recommId = recombeeResult != null ? recombeeResult.recommId() : null;

        // DB candidates fallback same as recommendRadio
        List<Song> dbCandidates = getDatabaseCandidates(seedSong, seedSongId);

        Set<String> excludes = new HashSet<>(excludeIds != null ? excludeIds : List.of());
        if (seedSongId != null) excludes.add(seedSongId);

        List<SongDto> ranked = rankingEngine.rankAndDiversify(seedSong, recombeeSongs, dbCandidates, excludes, count);
        if (!ranked.isEmpty()) {
            return new RadioResponseDto(ranked, recommId);
        }
        return new RadioResponseDto(fallbackCatalog(count), null);
    }

    private List<Song> getDatabaseCandidates(Song seedSong, String seedSongId) {
        List<Song> dbCandidates = new ArrayList<>();
        if (songsRepository != null && seedSong != null) {
            try {
                // Genre candidates (highest relevance)
                if (seedSong.getGenre() != null && !seedSong.getGenre().isBlank()) {
                    List<String> genreTokens = Arrays.stream(seedSong.getGenre().split(","))
                            .map(String::trim)
                            .filter(s -> !s.isBlank())
                            .distinct()
                            .toList();
                    if (genreTokens.size() <= 1) {
                        dbCandidates.addAll(songsRepository.findActiveByGenre(seedSong.getGenre().trim(), PageRequest.of(0, 30)));
                    } else {
                        int perGenre = Math.max(10, 30 / genreTokens.size());
                        for (String g : genreTokens) {
                            dbCandidates.addAll(songsRepository.findActiveByGenre(g, PageRequest.of(0, perGenre)));
                        }
                    }
                }
                // Language candidates
                if (seedSong.getLanguage() != null && !seedSong.getLanguage().isBlank()) {
                    dbCandidates.addAll(songsRepository.findActiveByLanguage(seedSong.getLanguage().trim(), PageRequest.of(0, 20)));
                }
                // Artist candidates (controlled sample across all comma-separated artists)
                if (seedSong.getArtistName() != null && !seedSong.getArtistName().isBlank()) {
                    List<String> artistTokens = Arrays.stream(seedSong.getArtistName().split("[,/&]|\\b(?:ft|feat)(?:\\.|\\b)"))
                            .map(s -> s.replaceAll("^[.\\s]+|[.\\s]+$", "").trim())
                            .filter(s -> !s.isBlank())
                            .distinct()
                            .toList();
                    if (artistTokens.size() <= 1) {
                        dbCandidates.addAll(songsRepository.findActiveByArtistName(seedSong.getArtistName().trim(), PageRequest.of(0, 10)));
                    } else {
                        int perArtist = Math.max(5, 10 / artistTokens.size());
                        for (String a : artistTokens) {
                            dbCandidates.addAll(songsRepository.findActiveByArtistName(a, PageRequest.of(0, perArtist)));
                        }
                    }
                }
                // Album candidates
                if (seedSong.getAlbum() != null && !seedSong.getAlbum().isBlank()) {
                    dbCandidates.addAll(songsRepository.findByAlbum(seedSong.getAlbum().trim()));
                }
                // Country candidates (regional relevance)
                if (seedSong.getCountry() != null && !seedSong.getCountry().isBlank()) {
                    dbCandidates.addAll(songsRepository.findByCountry(seedSong.getCountry().trim(), PageRequest.of(0, 15)));
                }
                // General active catalog tracks
                dbCandidates.addAll(songsRepository.findActiveSongs(PageRequest.of(0, 20)));
            } catch (Exception ex) {
                log.warn("Error gathering DB candidates for seed {}: {}", seedSongId, ex.getMessage());
            }
        }
        return dbCandidates;
    }

    public List<SongDto> recommendForUser(String userId, int count) {
        if (userId == null || userId.isBlank() || "anonymous".equalsIgnoreCase(userId.trim())) {
            return fallbackCatalog(count);
        }

        // 1. Primary: Recombee AI Personalized Recommendations for User
        List<SongDto> recombeeUserSongs = new ArrayList<>();
        try {
            List<String> songIds = recombee.recommendForUser(userId, Math.max(count * 3, 20));
            if (songIds != null && !songIds.isEmpty() && songsRepository != null) {
                Map<String, Song> songMap = songsRepository.findAllByIds(songIds).stream()
                        .filter(s -> s.getStatus() == null || s.getStatus() == StatusEnum.ACTIVE)
                        .collect(Collectors.toMap(Song::getId, Function.identity(), (a, b) -> a));

                for (String id : songIds) {
                    Song song = songMap.get(id);
                    if (song != null) {
                        recombeeUserSongs.add(SongDto.fromEntity(song));
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Recombee user recommendation failed for user {}: {}", userId, e.getMessage());
        }

        // 2. User History Vibe Seed: Extract recent genres/artists to provide context
        List<Song> dbCandidates = new ArrayList<>();
        Song vibeSeed = null;
        if (userHistoryRepository != null && usersRepository != null && songsRepository != null) {
            try {
                User user = usersRepository.findById(userId).orElse(null);
                if (user != null) {
                    // P8: Fire repeat-listen rating signals asynchronously (best-effort)
                    fireRepeatListenSignals(user, userId);
                    List<UserHistory> recent = userHistoryRepository.findRecentByUser(user, 20);
                    if (recent == null || recent.isEmpty()) {
                        // P6: Cold-start — no history yet, use onboarding genre prefs
                        if (genrePreferenceService != null && genrePreferenceService.hasPreferences(userId)) {
                            List<String> prefGenres = genrePreferenceService.getPreferences(userId);
                            int pg = Math.max(5, 20 / Math.max(1, prefGenres.size()));
                            for (String g : prefGenres) {
                                dbCandidates.addAll(songsRepository.findActiveByGenre(g, PageRequest.of(0, pg)));
                            }
                            recColdStartCounter.increment();
                            log.debug("[P6] Cold-start genre prefs used for user={}: {}", userId, prefGenres);
                        }
                    } else if (!recent.isEmpty()) {
                        Map<String, Double> genreWeights = new java.util.LinkedHashMap<>();
                        Song bestVibeSeed = null;
                        int bestPart = -1;

                        for (int i = 0; i < recent.size(); i++) {
                            UserHistory h = recent.get(i);
                            if (h.getSong() == null) continue;

                            // Recency decay: index 0 = most recent → weight 1.0, decays 10% per position
                            double recencyWeight = Math.pow(0.90, i);
                            // Completion boost: ≥90% = 1.5×, ≥50% = 1.2×, <25% = 0.6×
                            int part = h.getPart() != null ? h.getPart() : 0;
                            double completionWeight = part >= 90 ? 1.5 : part >= 50 ? 1.2 : 0.6;
                            double weight = recencyWeight * completionWeight;

                            // Track best vibeSeed as the most-completed recent track
                            if (part > bestPart) {
                                bestPart = part;
                                bestVibeSeed = h.getSong();
                            }

                            // Accumulate weighted genre scores
                            if (h.getSong().getGenre() != null && !h.getSong().getGenre().isBlank()) {
                                List<String> tokens = Arrays.stream(h.getSong().getGenre().split(","))
                                        .map(String::trim)
                                        .filter(s -> !s.isBlank())
                                        .distinct()
                                        .toList();
                                int perGenre = Math.max(5, 15 / Math.max(1, tokens.size()));
                                for (String g : tokens) {
                                    genreWeights.merge(g, weight, Double::sum);
                                }
                            }
                        }

                        // Set vibeSeed to best-completed song (not just first)
                        if (bestVibeSeed != null) vibeSeed = bestVibeSeed;

                        // Fetch DB candidates for top 3 weighted genres
                        List<String> topGenres = genreWeights.entrySet().stream()
                                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                                .limit(3)
                                .map(Map.Entry::getKey)
                                .toList();
                        int perGenre = Math.max(5, 15 / Math.max(1, topGenres.size()));
                        for (String g : topGenres) {
                            dbCandidates.addAll(songsRepository.findActiveByGenre(g, PageRequest.of(0, perGenre)));
                        }
                    }
                }
            } catch (Exception ex) {
                log.warn("User history fallback recommendation failed for user {}: {}", userId, ex.getMessage());
            }
        }

        if (songsRepository != null) {
            dbCandidates.addAll(songsRepository.findActiveSongs(PageRequest.of(0, 20)));
        }

        // 3. Multi-factor rank and enforce artist diversity for home user feed
        List<SongDto> diverseUserFeed = rankingEngine.rankAndDiversify(
                vibeSeed,
                recombeeUserSongs,
                dbCandidates,
                Set.of(),
                count
        );

        if (!diverseUserFeed.isEmpty()) {
            recServCounter.increment();
            return diverseUserFeed;
        }

        recFallbackCounter.increment();
        return fallbackCatalog(count);
    }

    // ── P8: Send repeat-listen strong signals to Recombee (songs played 3+ times with ≥70% avg completion) ──
    private void fireRepeatListenSignals(User user, String userId) {
        if (userHistoryRepository == null || user == null) return;
        try {
            java.time.LocalDateTime thirtyDaysAgo = java.time.LocalDateTime.now().minusDays(30);
            List<Object[]> frequentSongs = userHistoryRepository.findFrequentlyPlayedSongs(
                    user, thirtyDaysAgo, 3L, PageRequest.of(0, 10));
            for (Object[] row : frequentSongs) {
                String freqSongId = (String) row[0];
                double avgCompletion = row[2] instanceof Number ? ((Number) row[2]).doubleValue() : 0.0;
                if (avgCompletion >= 70.0) {
                    try {
                        recombee.trackRating(userId, freqSongId, 1.0);
                    } catch (Exception ignored) {}
                }
            }
        } catch (Exception ex) {
            log.warn("[Recommendation] Repeat-listen Recombee signal failed for user {}: {}", userId, ex.getMessage());
        }
    }

    private List<SongDto> fallbackCatalog(int count) {
        if (songsRepository != null) {
            try {
                return songsRepository.findActiveSongs(PageRequest.of(0, count))
                        .stream()
                        .map(SongDto::fromEntity)
                        .toList();
            } catch (Exception ex) {
                log.warn("Catalog fallback recommendation failed: {}", ex.getMessage());
            }
        }
        return List.of();
    }
}

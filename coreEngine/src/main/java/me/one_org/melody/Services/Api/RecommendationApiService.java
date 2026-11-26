package me.one_org.melody.Services.Api;

import java.util.*;
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
import me.one_org.melody.Recommendation.AudioProfile;
import me.one_org.melody.Recommendation.Recombee;
import me.one_org.melody.Recommendation.RecommendationRankingEngine;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Repository.UserHistoryRepository;
import me.one_org.melody.Repository.UsersRepository;

/**
 * Recommendations ka dimaag: similar songs, radio, session radio, aur "For you".
 *
 * Tareeka (radio): Recombee ke suggestions + database ke candidates (same genre/artist/album/language)
 * -> RecommendationRankingEngine se score aur variety -> agar kuch na bache to catalog fallback.
 * "For you": Recombee -> nahi to user ki history ka vibe -> naya user ho to onboarding genres.
 *
 * Service = asli business logic. Controller isko call karta hai, ye repositories (DB), cache aur
 * bahar ki services (Recombee, Algolia) ko use karta hai.
 * @Transactional(readOnly = true) = by default sirf padhne wale DB transactions (thode fast);
 * jo methods data badalte hain un pe alag se @Transactional laga hai.
 * @Cacheable = result Redis me cache hota hai (RedisConfig dekho).
 */
@Service
@Slf4j
@Transactional(readOnly = true)
public class RecommendationApiService {

    private final Recombee recombee;
    private final SongsRepository songsRepository;
    private final UserHistoryRepository userHistoryRepository;
    private final UsersRepository usersRepository;
    private final RecommendationRankingEngine rankingEngine;

    // Naye user ke chune hue genres (cold start)
    private final UserGenrePreferenceService genrePreferenceService;

    // Metrics counters (Micrometer): kitni recommendations kahan se aayin
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
        // Tests me MeterRegistry nahi hota - tab "kuch na karne wale" counters
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

    /** Tests ke liye chhote constructors (kam dependencies ke saath). */
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

    /** Is gaane jaise gaane (radio hi, bina exclude list ke). */
    public List<SongDto> recommendSimilar(String songId, int count) {
        return recommendRadio(songId, List.of(), count);
    }

    /** Seed gaane se radio queue: Recombee + DB candidates -> rank + variety -> fallback. */
    public List<SongDto> recommendRadio(String seedSongId, List<String> excludeIds, int count) {
        Song seedSong = null;
        if (songsRepository != null && seedSongId != null && !seedSongId.isBlank()) {
            seedSong = songsRepository.findById(seedSongId).orElse(null);
        }

        // 1. Recombee se suggestions lo (zaroorat se zyada maangte hain, taaki diversity filter ke baad bhi kaafi bachein)
        List<SongDto> recombeeHits = List.of();
        if (seedSongId != null && !seedSongId.isBlank()) {
            try {
                recombeeHits = recombee.recommendRadioDetailed(seedSongId, excludeIds, Math.max(count * 3, 20));
            } catch (Exception e) {
                log.warn("Recombee radio recommendation failed for seed {}: {}", seedSongId, e.getMessage());
            }
        }

        // 2. Database se bhi candidates lo: same genre, language, artist, album
        List<Song> dbCandidates = getDatabaseCandidates(seedSong, seedSongId);

        // 3. Kaunse gaane nahi chahiye: seed song aur app ne jo excludeIds bheje
        Set<String> excludes = new HashSet<>();
        if (excludeIds != null) {
            excludes.addAll(excludeIds);
        }
        if (seedSongId != null) {
            excludes.add(seedSongId);
        }

        // 4. Score do, rank karo, aur ek artist/album ke zyada gaane na aane do
        List<SongDto> diverseRecommendations = rankingEngine.rankAndDiversify(
                seedSong,
                seedAudioProfile(seedSong),
                recombeeHits,
                dbCandidates,
                excludes,
                count
        );

        if (!diverseRecommendations.isEmpty()) {
            return diverseRecommendations;
        }

        // 5. Kuch bhi na mile to catalog ke active songs
        return fallbackCatalog(count);
    }

    /**
     * Session radio: recommRadio jaisa, par Recombee ka recommId bhi lautata hai
     * taaki agla batch pichle ke aage se aaye.
     */
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

        // Database candidates bhi, bilkul recommendRadio jaise
        List<Song> dbCandidates = getDatabaseCandidates(seedSong, seedSongId);

        Set<String> excludes = new HashSet<>(excludeIds != null ? excludeIds : List.of());
        if (seedSongId != null) excludes.add(seedSongId);

        List<SongDto> ranked = rankingEngine.rankAndDiversify(
                seedSong, seedAudioProfile(seedSong), recombeeSongs, dbCandidates, excludes, count);
        if (!ranked.isEmpty()) {
            return new RadioResponseDto(ranked, recommId);
        }
        return new RadioResponseDto(fallbackCatalog(count), null);
    }

    /**
     * Seed song ke audio features (energy, valence, tempo...).
     * Pehle song row me rakhe features use karte hain; row me na hon (purane songs) tabhi Recombee se maangte hain.
     * Kuch na mile to null. Genre se bane "nakli" seed (jinki id nahi) ka koi profile nahi hota.
     */
    AudioProfile seedAudioProfile(Song seedSong) {
        if (seedSong == null || seedSong.getId() == null) return null;
        AudioProfile stored = AudioProfile.of(seedSong);
        if (stored != null || recombee == null) return stored;
        return recombee.getAudioProfile(seedSong.getId());
    }

    /** Database se candidates: same genre (sabse zyada), language, artist(s), album, country, phir koi bhi. */
    private List<Song> getDatabaseCandidates(Song seedSong, String seedSongId) {
        List<Song> dbCandidates = new ArrayList<>();
        if (songsRepository != null && seedSong != null) {
            try {
                // Same genre ke gaane (sabse relevant)
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
                // Same language ke gaane
                if (seedSong.getLanguage() != null && !seedSong.getLanguage().isBlank()) {
                    dbCandidates.addAll(songsRepository.findActiveByLanguage(seedSong.getLanguage().trim(), PageRequest.of(0, 20)));
                }
                // Same artist(s) ke gaane (har artist se thode thode)
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
                // Same album ke gaane
                if (seedSong.getAlbum() != null && !seedSong.getAlbum().isBlank()) {
                    dbCandidates.addAll(songsRepository.findByAlbum(seedSong.getAlbum().trim()));
                }
                // Same country ke gaane (local pasand)
                if (seedSong.getCountry() != null && !seedSong.getCountry().isBlank()) {
                    dbCandidates.addAll(songsRepository.findByCountry(seedSong.getCountry().trim(), PageRequest.of(0, 15)));
                }
                // Koi bhi active gaane
                dbCandidates.addAll(songsRepository.findActiveSongs(PageRequest.of(0, 20)));
            } catch (Exception ex) {
                log.warn("Error gathering DB candidates for seed {}: {}", seedSongId, ex.getMessage());
            }
        }
        return dbCandidates;
    }

    /** "For you" list: Recombee -> history vibe -> onboarding genres -> catalog. Kaunsa source chala, metrics me ginte hain. */
    public List<SongDto> recommendForUser(String userId, int count) {
        if (userId == null || userId.isBlank() || "anonymous".equalsIgnoreCase(userId.trim())) {
            return fallbackCatalog(count);
        }

        // 1. Pehla source: Recombee ke is user ke liye personal suggestions
        List<SongDto> recombeeUserSongs = new ArrayList<>();
        try {
            Map<String, AudioProfile> recs = recombee.recommendForUserWithAudio(userId, Math.max(count * 3, 20));
            if (recs == null) {
                return recombeeUserSongs;
            }
            List<String> songIds = recs != null ? new ArrayList<>(recs.keySet()) : List.of();
            if (!songIds.isEmpty() && songsRepository != null) {
                Map<String, Song> songMap = songsRepository.findAllByIds(songIds).stream()
                        .filter(s -> s.getStatus() == null || s.getStatus() == StatusEnum.ACTIVE)
                        .collect(Collectors.toMap(Song::getId, Function.identity(), (a, b) -> a));

                for (String id : songIds) {
                    Song song = songMap.get(id);
                    if (song != null) {
                        // Song row ke audio features pehle; na hon to Recombee wale
                        SongDto dto = SongDto.fromEntity(song);
                        AudioProfile audio = recs.get(id);
                        if (audio != null && !dto.hasAudioFeatures()) {
                            dto = dto.withAudioFeatures(audio.tempo(), audio.energy(), audio.valence(), audio.danceability());
                        }
                        recombeeUserSongs.add(dto);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Recombee user recommendation failed for user {}: {}", userId, e.getMessage());
        }

        // 2. User ki history se "vibe": haal me sune genres/artists nikalo
        List<Song> dbCandidates = new ArrayList<>();
        Song vibeSeed = null;
        if (userHistoryRepository != null && usersRepository != null && songsRepository != null) {
            try {
                User user = usersRepository.findById(userId).orElse(null);
                if (user != null) {
                    // Baar baar sune gaanon ka signal Recombee ko (fail ho to koi baat nahi)
                    fireRepeatListenSignals(user, userId);
                    List<UserHistory> recent = userHistoryRepository.findRecentByUser(user, 20);
                    if (recent == null || recent.isEmpty()) {
                        // Cold start: history abhi nahi hai, onboarding me chune genres use karo
                        List<String> prefGenres = genrePreferenceService != null
                                ? genrePreferenceService.getPreferences(user)
                                : List.of();
                        if (!prefGenres.isEmpty()) {
                            // Sirf popularity nahi - chune genres se kitna milta hai, us hisaab se rank
                            vibeSeed = RecommendationRankingEngine.genreSeed(prefGenres);
                            int pg = Math.max(5, 20 / Math.max(1, prefGenres.size()));
                            for (String g : prefGenres) {
                                dbCandidates.addAll(songsRepository.findActiveByGenre(g, PageRequest.of(0, pg)));
                            }
                            recColdStartCounter.increment();
                            log.debug("[P6] Cold-start genre prefs used for user={}: {}", userId, prefGenres);
                        }
                    } else {
                        Map<String, Double> genreWeights = new java.util.LinkedHashMap<>();
                        int bestPart = -1;

                        for (int i = 0; i < recent.size(); i++) {
                            UserHistory h = recent.get(i);
                            if (h.getSong() == null) continue;

                            // Naya suna zyada important: sabse naya = 1.0, har purane pe 10% kam
                            double recencyWeight = Math.pow(0.90, i);
                            // Poora suna to zyada weight: 90%+ = 1.5x, 50%+ = 1.2x, 25% se kam = 0.6x
                            int part = h.getPart() != null ? h.getPart() : 0;
                            double completionWeight = part >= 90 ? 1.5 : part >= 50 ? 1.2 : 0.6;
                            double weight = recencyWeight * completionWeight;

                            // Sabse zyada poora suna haal ka gaana = vibe seed
                            if (part > bestPart) {
                                bestPart = part;
                                vibeSeed = h.getSong();
                            }

                            // Har genre ke points jodo
                            if (h.getSong().getGenre() != null && !h.getSong().getGenre().isBlank()) {
                                List<String> tokens = Arrays.stream(h.getSong().getGenre().split(","))
                                        .map(String::trim)
                                        .filter(s -> !s.isBlank())
                                        .distinct()
                                        .toList();
                                for (String g : tokens) {
                                    genreWeights.merge(g, weight, Double::sum);
                                }
                            }
                        }

                        // Top 3 genres ke gaane database se lao
                        List<String> topGenres = genreWeights.entrySet().stream()
                                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                                .limit(3)
                                .map(Map.Entry::getKey)
                                .toList();
                        int fetchLimit = Math.max(5, 15 / Math.max(1, topGenres.size()));
                        for (String g : topGenres) {
                            dbCandidates.addAll(songsRepository.findActiveByGenre(g, PageRequest.of(0, fetchLimit)));
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

        // 3. Kai factors se rank karo aur dhyan rakho ki ek hi artist ke bahut gaane na hon
        List<SongDto> diverseUserFeed = rankingEngine.rankAndDiversify(
                vibeSeed,
                seedAudioProfile(vibeSeed),
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

    // ── Baar baar sune gaane (3+ baar, avg 70%+) ka strong signal Recombee ko ──
    /** User ke 3+ baar, 70%+ sune gaanon ka strong signal Recombee ko (async, fail ho to ignore). */
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

    /** Kuch kaam na kare to bas catalog ke active songs. */
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

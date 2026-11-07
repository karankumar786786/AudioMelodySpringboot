package me.one_org.melody.Services.Api;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.extern.slf4j.Slf4j;
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

@Service
@Slf4j
@Transactional(readOnly = true)
public class RecommendationApiService {

    private final Recombee recombee;
    private final SongsRepository songsRepository;
    private final UserHistoryRepository userHistoryRepository;
    private final UsersRepository usersRepository;
    private final RecommendationRankingEngine rankingEngine;

    @Autowired
    public RecommendationApiService(
            Recombee recombee,
            @Autowired(required = false) SongsRepository songsRepository,
            @Autowired(required = false) UserHistoryRepository userHistoryRepository,
            @Autowired(required = false) UsersRepository usersRepository,
            @Autowired(required = false) RecommendationRankingEngine rankingEngine) {
        this.recombee = recombee;
        this.songsRepository = songsRepository;
        this.userHistoryRepository = userHistoryRepository;
        this.usersRepository = usersRepository;
        this.rankingEngine = (rankingEngine != null) ? rankingEngine : new RecommendationRankingEngine();
    }

    public RecommendationApiService(Recombee recombee) {
        this(recombee, null, null, null, null);
    }

    public RecommendationApiService(Recombee recombee, SongsRepository songsRepository) {
        this(recombee, songsRepository, null, null, null);
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
                // Artist candidates (controlled sample)
                if (seedSong.getArtistName() != null && !seedSong.getArtistName().isBlank()) {
                    dbCandidates.addAll(songsRepository.findActiveByArtistName(seedSong.getArtistName().trim(), PageRequest.of(0, 10)));
                }
                // Album candidates
                if (seedSong.getAlbum() != null && !seedSong.getAlbum().isBlank()) {
                    dbCandidates.addAll(songsRepository.findByAlbum(seedSong.getAlbum().trim()));
                }
                // General active catalog tracks
                dbCandidates.addAll(songsRepository.findActiveSongs(PageRequest.of(0, 20)));
            } catch (Exception ex) {
                log.warn("Error gathering DB candidates for seed {}: {}", seedSongId, ex.getMessage());
            }
        }

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
                    List<UserHistory> recent = userHistoryRepository.findRecentByUser(user, 3);
                    if (recent != null && !recent.isEmpty()) {
                        for (UserHistory h : recent) {
                            if (h.getSong() != null) {
                                if (vibeSeed == null) {
                                    vibeSeed = h.getSong();
                                }
                                if (h.getSong().getGenre() != null && !h.getSong().getGenre().isBlank()) {
                                    List<String> tokens = Arrays.stream(h.getSong().getGenre().split(","))
                                            .map(String::trim)
                                            .filter(s -> !s.isBlank())
                                            .distinct()
                                            .toList();
                                    int perGenre = Math.max(5, 15 / Math.max(1, tokens.size()));
                                    for (String g : tokens) {
                                        dbCandidates.addAll(songsRepository.findActiveByGenre(g, PageRequest.of(0, perGenre)));
                                    }
                                }
                            }
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
            return diverseUserFeed;
        }

        return fallbackCatalog(count);
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

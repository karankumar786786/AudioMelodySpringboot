package me.one_org.melody.Services.Api;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
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

    @Autowired
    public RecommendationApiService(
            Recombee recombee,
            @Autowired(required = false) SongsRepository songsRepository,
            @Autowired(required = false) UserHistoryRepository userHistoryRepository,
            @Autowired(required = false) UsersRepository usersRepository) {
        this.recombee = recombee;
        this.songsRepository = songsRepository;
        this.userHistoryRepository = userHistoryRepository;
        this.usersRepository = usersRepository;
    }

    public RecommendationApiService(Recombee recombee) {
        this(recombee, null, null, null);
    }

    public RecommendationApiService(Recombee recombee, SongsRepository songsRepository) {
        this(recombee, songsRepository, null, null);
    }

    public List<SongDto> recommendSimilar(String songId, int count) {
        List<SongDto> recomms = List.of();
        try {
            recomms = recombee.recommendSimilarDetailed(songId, count);
        } catch (Exception e) {
            log.warn("Recombee similar recommendation failed for song {}: {}", songId, e.getMessage());
        }

        if (recomms != null && !recomms.isEmpty()) {
            return recomms;
        }

        // Fallback to database songs matching album, genre, artist, and language
        if (songsRepository != null && songId != null && !songId.isBlank()) {
            try {
                return songsRepository.findById(songId)
                        .map(seed -> songsRepository.findRadioFallback(
                                seed.getAlbum(),
                                seed.getGenre(),
                                seed.getArtistName(),
                                seed.getLanguage(),
                                List.of(songId),
                                count
                        ).stream().map(SongDto::fromEntity).toList())
                        .orElse(List.of());
            } catch (Exception ex) {
                log.warn("DB fallback similar recommendation failed for song {}: {}", songId, ex.getMessage());
            }
        }

        return List.of();
    }

    public List<SongDto> recommendRadio(String seedSongId, List<String> excludeIds, int count) {
        List<SongDto> recomms = List.of();
        try {
            recomms = recombee.recommendRadioDetailed(seedSongId, excludeIds, count);
        } catch (Exception e) {
            log.warn("Recombee radio recommendation failed for seed {}: {}", seedSongId, e.getMessage());
        }

        if (recomms != null && !recomms.isEmpty()) {
            return recomms;
        }

        // Fallback to database songs matching album, genre, artist, and language
        if (songsRepository != null && seedSongId != null && !seedSongId.isBlank()) {
            try {
                List<String> excludes = excludeIds != null ? new ArrayList<>(excludeIds) : new ArrayList<>();
                if (!excludes.contains(seedSongId)) {
                    excludes.add(seedSongId);
                }
                return songsRepository.findById(seedSongId)
                        .map(seed -> songsRepository.findRadioFallback(
                                seed.getAlbum(),
                                seed.getGenre(),
                                seed.getArtistName(),
                                seed.getLanguage(),
                                excludes,
                                count
                        ).stream().map(SongDto::fromEntity).toList())
                        .orElse(List.of());
            } catch (Exception ex) {
                log.warn("DB fallback radio recommendation failed for seed {}: {}", seedSongId, ex.getMessage());
            }
        }

        return List.of();
    }

    public List<SongDto> recommendForUser(String userId, int count) {
        if (userId == null || userId.isBlank() || "anonymous".equalsIgnoreCase(userId.trim())) {
            return fallbackCatalog(count);
        }

        // 1. Primary: Recombee AI Personalized Recommendations for User
        try {
            List<String> songIds = recombee.recommendForUser(userId, count);
            if (songIds != null && !songIds.isEmpty() && songsRepository != null) {
                Map<String, Song> songMap = songsRepository.findAllByIds(songIds).stream()
                        .filter(s -> s.getStatus() == null || s.getStatus() == StatusEnum.ACTIVE)
                        .collect(Collectors.toMap(Song::getId, Function.identity(), (a, b) -> a));

                List<SongDto> ordered = new ArrayList<>();
                for (String id : songIds) {
                    Song song = songMap.get(id);
                    if (song != null) {
                        ordered.add(SongDto.fromEntity(song));
                    }
                }
                if (!ordered.isEmpty()) {
                    return ordered;
                }
            }
        } catch (Exception e) {
            log.warn("Recombee user recommendation failed for user {}: {}", userId, e.getMessage());
        }

        // 2. User History Vibe Fallback: If user has history, use their most recent song as seed
        if (userHistoryRepository != null && usersRepository != null && songsRepository != null) {
            try {
                User user = usersRepository.findById(userId).orElse(null);
                if (user != null) {
                    List<UserHistory> recent = userHistoryRepository.findRecentByUser(user, 1);
                    if (recent != null && !recent.isEmpty() && recent.get(0).getSong() != null) {
                        Song seed = recent.get(0).getSong();
                        List<SongDto> fallbackRecs = songsRepository.findRadioFallback(
                                seed.getAlbum(),
                                seed.getGenre(),
                                seed.getArtistName(),
                                seed.getLanguage(),
                                List.of(seed.getId()),
                                count
                        ).stream().map(SongDto::fromEntity).toList();

                        if (!fallbackRecs.isEmpty()) {
                            return fallbackRecs;
                        }
                    }
                }
            } catch (Exception ex) {
                log.warn("User history fallback recommendation failed for user {}: {}", userId, ex.getMessage());
            }
        }

        // 3. Catalog Fallback: Active songs from DB
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

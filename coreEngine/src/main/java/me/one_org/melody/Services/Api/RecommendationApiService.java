package me.one_org.melody.Services.Api;

import java.util.List;

import org.springframework.stereotype.Service;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Recommendation.Recombee;
import me.one_org.melody.Repository.SongsRepository;

@Service
@Slf4j
public class RecommendationApiService {

    private final Recombee recombee;
    private final SongsRepository songsRepository;

    public RecommendationApiService(Recombee recombee, SongsRepository songsRepository) {
        this.recombee = recombee;
        this.songsRepository = songsRepository;
    }

    public List<SongsEntity> recommendForUser(String userId, int count) {
        try {
            List<String> songIds = recombee.recommendForUser(userId, count);
            return songsRepository.findAllByIds(songIds);
        } catch (Exception e) {
            log.error("Recombee recommendation failed for user {}: {}", userId, e.getMessage());
            return List.of();
        }
    }

    public List<SongsEntity> recommendSimilar(String songId, int count) {
        try {
            List<String> songIds = recombee.recommendSimilar(songId, count);
            return songsRepository.findAllByIds(songIds);
        } catch (Exception e) {
            log.error("Recombee similar recommendation failed for song {}: {}", songId, e.getMessage());
            return List.of();
        }
    }

    public List<SongsEntity> recommendRadio(String seedSongId, List<String> excludeIds, int count) {
        java.util.Set<String> excludedSet = new java.util.HashSet<>();
        if (excludeIds != null) {
            for (String id : excludeIds) {
                if (id != null && !id.isBlank()) {
                    excludedSet.add(id.trim());
                }
            }
        }
        if (seedSongId != null) {
            excludedSet.add(seedSongId.trim());
        }

        java.util.Optional<SongsEntity> seedOpt = seedSongId != null
                ? songsRepository.findById(seedSongId)
                : java.util.Optional.empty();

        List<SongsEntity> result = new java.util.ArrayList<>();

        // 1. Recombee AI item-to-item similarity
        if (seedSongId != null) {
            try {
                List<String> rawIds = recombee.recommendSimilar(seedSongId, Math.max(count * 2, 20));
                List<String> filteredIds = rawIds.stream()
                        .filter(id -> !excludedSet.contains(id))
                        .limit(count)
                        .toList();

                if (!filteredIds.isEmpty()) {
                    List<SongsEntity> fetched = songsRepository.findAllByIds(filteredIds);
                    java.util.Map<String, SongsEntity> songMap = fetched.stream()
                            .filter(s -> s.getStatus() == me.one_org.melody.Enums.StatusEnum.ACTIVE)
                            .collect(java.util.stream.Collectors.toMap(SongsEntity::getId, java.util.function.Function.identity(), (a, b) -> a));

                    for (String id : filteredIds) {
                        SongsEntity song = songMap.get(id);
                        if (song != null && !excludedSet.contains(song.getId())) {
                            result.add(song);
                            excludedSet.add(song.getId());
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("Recombee radio similarity failed for seed {}: {}", seedSongId, e.getMessage());
            }
        }

        // 2. Tiered database fallback (Artist -> Language -> Active Catalog)
        if (result.size() < count) {
            int remaining = count - result.size();
            String artistName = seedOpt.map(SongsEntity::getArtistName).orElse(null);
            String language = seedOpt.map(SongsEntity::getLanguage).orElse(null);

            List<SongsEntity> fallbacks = songsRepository.findRadioFallback(
                    artistName,
                    language,
                    new java.util.ArrayList<>(excludedSet),
                    remaining);

            result.addAll(fallbacks);
        }

        return result;
    }
}

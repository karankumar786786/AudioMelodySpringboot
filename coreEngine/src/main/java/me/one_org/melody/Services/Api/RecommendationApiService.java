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
}

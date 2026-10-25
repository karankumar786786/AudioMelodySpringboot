package me.one_org.melody.Services.Api;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Recommendation.Recombee;

@Service
@Slf4j
@Transactional(readOnly = true)
public class RecommendationApiService {

    private final Recombee recombee;

    public RecommendationApiService(Recombee recombee) {
        this.recombee = recombee;
    }

    public List<SongDto> recommendSimilar(String songId, int count) {
        try {
            return recombee.recommendSimilarDetailed(songId, count);
        } catch (Exception e) {
            log.error("Recombee similar recommendation failed for song {}: {}", songId, e.getMessage());
            return List.of();
        }
    }

    public List<SongDto> recommendRadio(String seedSongId, List<String> excludeIds, int count) {
        try {
            return recombee.recommendRadioDetailed(seedSongId, excludeIds, count);
        } catch (Exception e) {
            log.error("Recombee radio recommendation failed for seed {}: {}", seedSongId, e.getMessage());
            return List.of();
        }
    }

    @Deprecated
    public List<SongDto> recommendForUser(String userId, int count) {
        log.info("recommendForUser called for {} — recommendations are now contextual item-to-item vibe based", userId);
        return List.of();
    }
}

package me.one_org.melody.Services.Api;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Entity.User;
import me.one_org.melody.Entity.UserHistory;
import me.one_org.melody.Recommendation.Mood;
import me.one_org.melody.Recommendation.RecommendationRankingEngine;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Repository.UserHistoryRepository;
import me.one_org.melody.Repository.UsersRepository;

/**
 * Mood radio: a queue of songs that sound like a {@link Mood}. Candidates come from the database by
 * the mood's feature ranges and are ranked by the shared engine with the mood's target profile as
 * the seed audio, so ordering and artist/album diversity match the other radios. No Recombee call.
 */
@Service
@Slf4j
@Transactional(readOnly = true)
public class MoodRadioService {

    public static final int DEFAULT_COUNT = 20;
    public static final int MAX_COUNT = 50;
    /** How many of the user's most recent distinct plays are kept out of the queue. */
    static final int RECENTLY_PLAYED_WINDOW = 50;
    /** Candidate pool size: enough headroom for diversity quotas and recently-played exclusion. */
    static final int MIN_CANDIDATE_POOL = 100;
    static final int CANDIDATE_POOL_MULTIPLIER = 5;

    private final SongsRepository songsRepository;
    private final UserHistoryRepository userHistoryRepository;
    private final UsersRepository usersRepository;
    private final RecommendationRankingEngine rankingEngine;

    public MoodRadioService(
            SongsRepository songsRepository,
            UserHistoryRepository userHistoryRepository,
            UsersRepository usersRepository,
            @Autowired(required = false) RecommendationRankingEngine rankingEngine) {
        this.songsRepository = songsRepository;
        this.userHistoryRepository = userHistoryRepository;
        this.usersRepository = usersRepository;
        this.rankingEngine = rankingEngine != null ? rankingEngine : new RecommendationRankingEngine();
    }

    public List<SongDto> recommendMood(Mood mood, String userId, int count) {
        if (mood == null) throw new IllegalArgumentException("Mood is required");
        int target = count <= 0 ? DEFAULT_COUNT : Math.min(count, MAX_COUNT);

        List<Song> candidates = songsRepository.findActiveByAudioRange(
                mood.minEnergy(), mood.maxEnergy(),
                mood.minValence(), mood.maxValence(),
                mood.minTempo(), mood.maxTempo(),
                PageRequest.of(0, Math.max(MIN_CANDIDATE_POOL, target * CANDIDATE_POOL_MULTIPLIER)));
        if (candidates == null || candidates.isEmpty()) {
            log.debug("Mood radio {}: no songs with matching audio features", mood);
            return List.of();
        }

        Set<String> recentlyPlayed = recentlyPlayedIds(userId);
        List<SongDto> ranked = new ArrayList<>(rankingEngine.rankAndDiversify(
                null, mood.target(), List.of(), candidates, recentlyPlayed, target));

        // Small catalog: rather than return a short queue, top up with recently played matches
        if (ranked.size() < target && !recentlyPlayed.isEmpty()) {
            Set<String> alreadyQueued = new HashSet<>();
            for (SongDto dto : ranked) alreadyQueued.add(dto.id());
            ranked.addAll(rankingEngine.rankAndDiversify(
                    null, mood.target(), List.of(), candidates, alreadyQueued, target - ranked.size()));
        }
        return ranked;
    }

    private Set<String> recentlyPlayedIds(String userId) {
        if (userId == null || userId.isBlank() || "anonymous".equalsIgnoreCase(userId.trim())) {
            return Set.of();
        }
        try {
            User user = usersRepository.findById(userId).orElse(null);
            if (user == null) return Set.of();
            Set<String> ids = new HashSet<>();
            for (UserHistory h : userHistoryRepository.findRecentByUser(user, RECENTLY_PLAYED_WINDOW)) {
                if (h.getSong() != null && h.getSong().getId() != null) ids.add(h.getSong().getId());
            }
            return ids;
        } catch (Exception e) {
            log.warn("Mood radio: recently played lookup failed for user {}: {}", userId, e.getMessage());
            return Set.of();
        }
    }
}

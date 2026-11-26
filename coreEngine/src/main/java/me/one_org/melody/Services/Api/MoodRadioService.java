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
 * Mood radio: aise gaano ki queue jo ek {@link Mood} (chill, workout, focus, happy, sad) jaise sunai dein.
 * Candidates database se aate hain - mood ki energy / valence / tempo range ke hisaab se.
 * Phir wahi ranking engine (RecommendationRankingEngine) unhe sort karta hai, jisme mood ka "target sound"
 * seed ki tarah kaam karta hai - isliye order aur artist/album variety baaki radios jaisi rehti hai.
 * Isme Recombee call nahi hoti.
 */
@Service
@Slf4j
@Transactional(readOnly = true)
public class MoodRadioService {

    public static final int DEFAULT_COUNT = 20;
    public static final int MAX_COUNT = 50;
    /** User ke haal ke kitne alag gaane queue se bahar rakhne hain (taaki wahi gaane dobara na aayein). */
    static final int RECENTLY_PLAYED_WINDOW = 50;
    /** Kitne candidates laane hain: itne ki variety rules aur recently-played hatane ke baad bhi kaafi bachein. */
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

    /** Mood ke liye count gaane (max 50). User diya ho to uske haal ke sune gaane pehle bahar rakhte hain. */
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

        // Catalog chhota hai: chhoti queue dene ke bajaye haal me sune matching gaane bhi jod do
        if (ranked.size() < target && !recentlyPlayed.isEmpty()) {
            Set<String> alreadyQueued = new HashSet<>();
            for (SongDto dto : ranked) alreadyQueued.add(dto.id());
            ranked.addAll(rankingEngine.rankAndDiversify(
                    null, mood.target(), List.of(), candidates, alreadyQueued, target - ranked.size()));
        }
        return ranked;
    }

    /** User ne haal me jo gaane sune unki ids (login na ho to khaali). */
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

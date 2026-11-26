package me.one_org.melody.Services.Api;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Entity.User;
import me.one_org.melody.Entity.UserGenrePreference;
import me.one_org.melody.Repository.UserGenrePreferenceRepository;
import me.one_org.melody.Repository.UsersRepository;

/**
 * Onboarding me chune genres save / padhna. Naye user ki history nahi hoti ("cold start"),
 * tab recommendations inhi genres se bante hain.
 */
@Service
@Slf4j
public class UserGenrePreferenceService {

    /** Ek user max kitne genres rakh sakta hai. Request validation ke saath match hona chahiye. */
    public static final int MAX_GENRES = 10;
    public static final int MAX_GENRE_LENGTH = 50;

    private final UserGenrePreferenceRepository repo;
    private final UsersRepository usersRepository;
    private final TransactionTemplate tx;

    public UserGenrePreferenceService(UserGenrePreferenceRepository repo,
                                      UsersRepository usersRepository,
                                      PlatformTransactionManager transactionManager) {
        this.repo = repo;
        this.usersRepository = usersRepository;
        this.tx = new TransactionTemplate(transactionManager);
    }

    /**
     * User ke genres save karo (purane replace).
     * Agar do requests ek saath pehli baar save karein, to ek ki insert unique user_id pe fail hogi -
     * tab ek baar dobara try karte hain, jo ab update ban jaata hai.
     */
    public void savePreferences(String userId, List<String> genres) {
        List<String> clean = normalize(genres);
        if (clean.isEmpty()) {
            throw new IllegalArgumentException("At least one genre is required");
        }
        try {
            tx.executeWithoutResult(status -> upsert(userId, clean));
        } catch (DataIntegrityViolationException e) {
            log.debug("[P6] Concurrent genre preference insert for user={}, retrying as update", userId);
            tx.executeWithoutResult(status -> upsert(userId, clean));
        }
        log.info("[P6] Genre preferences saved for user={}: {}", userId, clean);
    }

    /** Row hai to update, nahi to insert ("upsert"). Genres comma se jod ke ek string me. */
    private void upsert(String userId, List<String> genres) {
        User user = usersRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        UserGenrePreference pref = repo.findByUser(user)
                .orElseGet(() -> {
                    UserGenrePreference p = new UserGenrePreference();
                    p.setId(UUID.randomUUID().toString());
                    p.setUser(user);
                    return p;
                });
        pref.setGenres(String.join(",", genres));
        repo.saveAndFlush(pref);
    }

    /** List saaf karo: space hatao, khaali aur comma wale hatao, duplicate hatao (case ignore), max 10 rakho. */
    static List<String> normalize(List<String> genres) {
        if (genres == null) return List.of();
        Map<String, String> unique = new LinkedHashMap<>();
        for (String g : genres) {
            if (g == null) continue;
            String trimmed = g.replace(",", " ").trim().replaceAll("\\s+", " ");
            if (trimmed.isEmpty() || trimmed.length() > MAX_GENRE_LENGTH) continue;
            unique.putIfAbsent(trimmed.toLowerCase(Locale.ROOT), trimmed);
            if (unique.size() >= MAX_GENRES) break;
        }
        return new ArrayList<>(unique.values());
    }

    /** User id se genres (kuch na ho to khaali list). */
    @Transactional(readOnly = true)
    public List<String> getPreferences(String userId) {
        return usersRepository.findById(userId)
                .map(this::getPreferences)
                .orElse(List.of());
    }

    /** Pehle se load hue user ke genres - sirf ek query. */
    @Transactional(readOnly = true)
    public List<String> getPreferences(User user) {
        if (user == null) return List.of();
        return repo.findByUser(user)
                .map(p -> Arrays.stream(p.getGenres().split(","))
                        .map(String::trim)
                        .filter(s -> !s.isBlank())
                        .toList())
                .orElse(List.of());
    }

    /** User ne genre onboarding kar li hai? */
    @Transactional(readOnly = true)
    public boolean hasPreferences(String userId) {
        return !getPreferences(userId).isEmpty();
    }
}

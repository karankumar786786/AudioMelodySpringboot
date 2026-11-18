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
 * P6: Manages cold-start genre preferences saved during onboarding.
 */
@Service
@Slf4j
public class UserGenrePreferenceService {

    /** Maximum number of genres a user can store. Keep in sync with the request validation. */
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
     * Save or replace genre preferences for the given user.
     * Safe against concurrent first-time saves: if another request inserted the row first
     * (unique user_id violation), the save is retried once as an update.
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

    /** Trims, drops blanks and commas, de-duplicates (case-insensitive) and caps the list. */
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

    /** Retrieve genre list (empty if not set). */
    @Transactional(readOnly = true)
    public List<String> getPreferences(String userId) {
        return usersRepository.findById(userId)
                .map(this::getPreferences)
                .orElse(List.of());
    }

    /** Retrieve genre list for an already-loaded user (empty if not set). Single query. */
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

    /** True if user has completed genre onboarding. */
    @Transactional(readOnly = true)
    public boolean hasPreferences(String userId) {
        return !getPreferences(userId).isEmpty();
    }
}

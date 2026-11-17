package me.one_org.melody.Services.Api;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    private final UserGenrePreferenceRepository repo;
    private final UsersRepository usersRepository;

    @Autowired
    public UserGenrePreferenceService(UserGenrePreferenceRepository repo,
                                      UsersRepository usersRepository) {
        this.repo = repo;
        this.usersRepository = usersRepository;
    }

    /** Save or replace genre preferences for the given user. */
    @Transactional
    public void savePreferences(String userId, List<String> genres) {
        User user = usersRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        String joined = String.join(",", genres);
        UserGenrePreference pref = repo.findByUser(user)
                .orElseGet(() -> {
                    UserGenrePreference p = new UserGenrePreference();
                    p.setId(UUID.randomUUID().toString());
                    p.setUser(user);
                    return p;
                });
        pref.setGenres(joined);
        repo.save(pref);
        log.info("[P6] Genre preferences saved for user={}: {}", userId, joined);
    }

    /** Retrieve genre list (empty if not set). */
    @Transactional(readOnly = true)
    public List<String> getPreferences(String userId) {
        return usersRepository.findById(userId)
                .flatMap(repo::findByUser)
                .map(p -> Arrays.stream(p.getGenres().split(","))
                        .map(String::trim)
                        .filter(s -> !s.isBlank())
                        .toList())
                .orElse(List.of());
    }

    /** True if user has completed genre onboarding. */
    @Transactional(readOnly = true)
    public boolean hasPreferences(String userId) {
        return usersRepository.findById(userId)
                .flatMap(repo::findByUser)
                .isPresent();
    }
}


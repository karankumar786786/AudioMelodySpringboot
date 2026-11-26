package me.one_org.melody.Repository;

import me.one_org.melody.Entity.User;
import me.one_org.melody.Entity.UserGenrePreference;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * Table user_genre_preferences ke liye queries.
 *
 * Repository = database se baat karne wali layer. Spring Data JPA in interfaces ka code khud bana deta hai:
 * method ka naam (findByEmail) ya @Query likho, SQL Spring chala dega.
 * @EntityGraph = related data (jaise songMetadata) ek hi query me saath laao, alag query (N+1 problem) se bacho.
 * @Modifying = ye query data badalti hai (UPDATE/DELETE), sirf padhti nahi.
 */
public interface UserGenrePreferenceRepository extends JpaRepository<UserGenrePreference, String> {

    /** User ke chune hue genres. */
    Optional<UserGenrePreference> findByUser(User user);
}


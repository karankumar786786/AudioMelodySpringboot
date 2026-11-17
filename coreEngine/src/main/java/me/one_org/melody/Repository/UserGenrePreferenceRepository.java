package me.one_org.melody.Repository;

import me.one_org.melody.Entity.User;
import me.one_org.melody.Entity.UserGenrePreference;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserGenrePreferenceRepository extends JpaRepository<UserGenrePreference, String> {

    Optional<UserGenrePreference> findByUser(User user);
}


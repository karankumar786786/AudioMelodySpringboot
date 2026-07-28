package me.one_org.melody.Repository;

import me.one_org.melody.Entity.Artists;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ArtistsRepository extends JpaRepository<Artists, String> {
}

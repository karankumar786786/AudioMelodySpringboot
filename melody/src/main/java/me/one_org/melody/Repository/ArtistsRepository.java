package me.one_org.melody.Repository;

import me.one_org.melody.Entity.Artists;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ArtistsRepository extends JpaRepository<Artists, String> {
}

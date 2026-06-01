package me.one_org.melody.Repository;

import me.one_org.melody.Entity.Songs;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SongsRepository extends JpaRepository<Songs, String> {
}

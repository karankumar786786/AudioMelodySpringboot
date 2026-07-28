package me.one_org.melody.Repository;

import me.one_org.melody.Entity.Songs;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SongsRepository extends JpaRepository<Songs, String> {
}

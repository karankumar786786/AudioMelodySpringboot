package me.one_org.melody.Repository;

import me.one_org.melody.Entity.Playlists;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlaylistsRepository extends JpaRepository<Playlists, String> {
}

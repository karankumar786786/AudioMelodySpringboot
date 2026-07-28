package me.one_org.melody.Repository;

import me.one_org.melody.Entity.UserPlaylists;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserPlaylistsRepository extends JpaRepository<UserPlaylists, String> {
}

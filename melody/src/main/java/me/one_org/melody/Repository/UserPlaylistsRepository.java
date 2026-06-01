package me.one_org.melody.Repository;

import me.one_org.melody.Entity.UserPlaylists;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserPlaylistsRepository extends JpaRepository<UserPlaylists, String> {
}

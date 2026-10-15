package me.one_org.melody.Repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import me.one_org.melody.Entity.User;
import me.one_org.melody.Entity.UserPlaylist;
import me.one_org.melody.Entity.UserSavedPlaylist;

public interface UserSavedPlaylistsRepository extends JpaRepository<UserSavedPlaylist, String> {

    Optional<UserSavedPlaylist> findByUserAndPlaylist(User user, UserPlaylist playlist);

    boolean existsByUserAndPlaylist(User user, UserPlaylist playlist);

    @Query("SELECT usp.playlist FROM UserSavedPlaylist usp WHERE usp.user.id = :userId ORDER BY usp.savedAt DESC")
    List<UserPlaylist> findSavedPlaylistsByUserId(@Param("userId") String userId);

    void deleteByUserAndPlaylist(User user, UserPlaylist playlist);

    @Query("SELECT COUNT(usp) > 0 FROM UserSavedPlaylist usp WHERE usp.user.id = :userId AND (usp.playlist.id = :tokenOrId OR usp.playlist.shareToken = :tokenOrId)")
    boolean isPlaylistSavedByUser(@Param("userId") String userId, @Param("tokenOrId") String tokenOrId);

    @Modifying
    @Transactional
    @Query("DELETE FROM UserSavedPlaylist usp WHERE usp.user.id = :userId AND (usp.playlist.id = :tokenOrId OR usp.playlist.shareToken = :tokenOrId)")
    int deleteByUserIdAndPlaylistTokenOrId(@Param("userId") String userId, @Param("tokenOrId") String tokenOrId);

    @Modifying
    @Transactional
    @Query("DELETE FROM UserSavedPlaylist usp WHERE usp.playlist = :playlist")
    void deleteByPlaylist(@Param("playlist") UserPlaylist playlist);
}

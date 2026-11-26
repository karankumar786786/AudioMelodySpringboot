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

/**
 * Table user_saved_playlists ke liye queries (doosron ki playlists jo user ne save ki).
 *
 * Repository = database se baat karne wali layer. Spring Data JPA in interfaces ka code khud bana deta hai:
 * method ka naam (findByEmail) ya @Query likho, SQL Spring chala dega.
 * @EntityGraph = related data (jaise songMetadata) ek hi query me saath laao, alag query (N+1 problem) se bacho.
 * @Modifying = ye query data badalti hai (UPDATE/DELETE), sirf padhti nahi.
 */
public interface UserSavedPlaylistsRepository extends JpaRepository<UserSavedPlaylist, String> {

    /** Ye user + ye playlist wali saved row. */
    Optional<UserSavedPlaylist> findByUserAndPlaylist(User user, UserPlaylist playlist);

    /** Kya user ne ye playlist save ki hai? */
    boolean existsByUserAndPlaylist(User user, UserPlaylist playlist);

    /** User ki saved playlists, haal me save ki hui pehle. */
    @Query("SELECT p FROM UserSavedPlaylist usp JOIN usp.playlist p LEFT JOIN FETCH p.user WHERE usp.user.id = :userId ORDER BY usp.savedAt DESC")
    List<UserPlaylist> findSavedPlaylistsByUserId(@Param("userId") String userId);

    /** Save hatao (unsave). */
    void deleteByUserAndPlaylist(User user, UserPlaylist playlist);

    /** Playlist id ya share token se check: user ne save ki hai? */
    @Query("SELECT COUNT(usp) > 0 FROM UserSavedPlaylist usp WHERE usp.user.id = :userId AND (usp.playlist.id = :tokenOrId OR usp.playlist.shareToken = :tokenOrId)")
    boolean isPlaylistSavedByUser(@Param("userId") String userId, @Param("tokenOrId") String tokenOrId);

    /** Playlist id ya share token se unsave. */
    @Modifying
    @Transactional
    @Query("DELETE FROM UserSavedPlaylist usp WHERE usp.user.id = :userId AND (usp.playlist.id = :tokenOrId OR usp.playlist.shareToken = :tokenOrId)")
    int deleteByUserIdAndPlaylistTokenOrId(@Param("userId") String userId, @Param("tokenOrId") String tokenOrId);

    /** Is playlist ke saare saves hatao (playlist delete hone pe). */
    @Modifying
    @Transactional
    @Query("DELETE FROM UserSavedPlaylist usp WHERE usp.playlist = :playlist")
    void deleteByPlaylist(@Param("playlist") UserPlaylist playlist);
}

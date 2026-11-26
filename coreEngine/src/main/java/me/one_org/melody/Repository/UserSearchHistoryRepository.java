package me.one_org.melody.Repository;

import me.one_org.melody.Entity.User;
import me.one_org.melody.Entity.UserPlaylist;
import me.one_org.melody.Entity.UserSearchHistory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Table user_search_history ke liye queries (recent searches).
 *
 * Repository = database se baat karne wali layer. Spring Data JPA in interfaces ka code khud bana deta hai:
 * method ka naam (findByEmail) ya @Query likho, SQL Spring chala dega.
 * @EntityGraph = related data (jaise songMetadata) ek hi query me saath laao, alag query (N+1 problem) se bacho.
 * @Modifying = ye query data badalti hai (UPDATE/DELETE), sirf padhti nahi.
 */
public interface UserSearchHistoryRepository extends JpaRepository<UserSearchHistory, String> {

    /** User ki recent searches, naya pehle, saari linked cheezon ke saath. */
    @EntityGraph(attributePaths = {"song", "song.songMetadata", "artist", "artist.artistMetadata", "playlist", "userPlaylist", "userPlaylist.user"})
    @Query("SELECT h FROM UserSearchHistory h WHERE h.user = :user ORDER BY h.createdAt DESC")
    List<UserSearchHistory> findByUserQuery(@Param("user") User user, Pageable pageable);

    /** Sabse nayi 20 searches. */
    default List<UserSearchHistory> findByUser(User user) {
        return findByUser(user, 20);
    }

    /** Sabse nayi limit searches. */
    default List<UserSearchHistory> findByUser(User user, int limit) {
        return findByUserQuery(user, PageRequest.of(0, limit));
    }

    /** Recent searches se ye song hatao. */
    @Modifying
    @Transactional
    @Query("DELETE FROM UserSearchHistory h WHERE h.user = :user AND h.song.id = :entityId")
    void deleteByUserAndSongId(@Param("user") User user, @Param("entityId") String entityId);

    /** Recent searches se ye artist hatao. */
    @Modifying
    @Transactional
    @Query("DELETE FROM UserSearchHistory h WHERE h.user = :user AND h.artist.id = :entityId")
    void deleteByUserAndArtistId(@Param("user") User user, @Param("entityId") String entityId);

    /** Recent searches se ye playlist hatao. */
    @Modifying
    @Transactional
    @Query("DELETE FROM UserSearchHistory h WHERE h.user = :user AND h.playlist.id = :entityId")
    void deleteByUserAndPlaylistId(@Param("user") User user, @Param("entityId") String entityId);

    /** Recent searches se ye user playlist hatao. */
    @Modifying
    @Transactional
    @Query("DELETE FROM UserSearchHistory h WHERE h.user = :user AND h.userPlaylist.id = :entityId")
    void deleteByUserAndUserPlaylistId(@Param("user") User user, @Param("entityId") String entityId);

    /**
     * Type ke hisaab se sahi delete method chalao.
     * Error aaye to chupchaap ignore - recent search hatana zaroori kaam nahi hai.
     */
    default void deleteByUserAndItem(User user, String entityType, String entityId) {
        if (entityType == null || entityId == null) return;
        try {
            if ("SONG".equalsIgnoreCase(entityType)) {
                deleteByUserAndSongId(user, entityId);
            } else if ("ARTIST".equalsIgnoreCase(entityType)) {
                deleteByUserAndArtistId(user, entityId);
            } else if ("PLAYLIST".equalsIgnoreCase(entityType)) {
                deleteByUserAndPlaylistId(user, entityId);
            } else if ("USER_PLAYLIST".equalsIgnoreCase(entityType)) {
                deleteByUserAndUserPlaylistId(user, entityId);
            }
        } catch (Exception ignored) {
        }
    }

    /** Is user playlist wali saari search entries hatao. */
    @Modifying
    @Transactional
    @Query("DELETE FROM UserSearchHistory h WHERE h.userPlaylist = :userPlaylist")
    void deleteByUserPlaylist(@Param("userPlaylist") UserPlaylist userPlaylist);

    /** Upar wala, id se. */
    @Modifying
    @Transactional
    @Query("DELETE FROM UserSearchHistory h WHERE h.userPlaylist.id = :userPlaylistId")
    void deleteByUserPlaylistId(@Param("userPlaylistId") String userPlaylistId);

    /** Ek entry hatao - sirf tab jab wo isi user ki ho. */
    @Modifying
    @Transactional
    @Query("DELETE FROM UserSearchHistory h WHERE h.id = :id AND h.user = :user")
    void deleteByIdAndUser(@Param("id") String id, @Param("user") User user);

    /** User ki saari recent searches saaf karo. */
    @Modifying
    @Transactional
    @Query("DELETE FROM UserSearchHistory h WHERE h.user = :user")
    void deleteByUser(@Param("user") User user);
}

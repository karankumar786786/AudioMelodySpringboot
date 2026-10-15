package me.one_org.melody.Repository;

import me.one_org.melody.Entity.User;
import me.one_org.melody.Entity.UserPlaylist;
import me.one_org.melody.Entity.UserSearchHistory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface UserSearchHistoryRepository extends JpaRepository<UserSearchHistory, String> {

    @Query("SELECT h FROM UserSearchHistory h " +
           "LEFT JOIN FETCH h.song s " +
           "LEFT JOIN FETCH s.songMetadata " +
           "LEFT JOIN FETCH h.artist a " +
           "LEFT JOIN FETCH a.artistMetadata " +
           "LEFT JOIN FETCH h.playlist " +
           "LEFT JOIN FETCH h.userPlaylist " +
           "WHERE h.user = :user ORDER BY h.createdAt DESC")
    List<UserSearchHistory> findByUserQuery(@Param("user") User user, Pageable pageable);

    default List<UserSearchHistory> findByUser(User user) {
        return findByUser(user, 20);
    }

    default List<UserSearchHistory> findByUser(User user, int limit) {
        return findByUserQuery(user, PageRequest.of(0, limit));
    }

    @Modifying
    @Transactional
    @Query("DELETE FROM UserSearchHistory h WHERE h.user = :user AND h.song.id = :entityId")
    void deleteByUserAndSongId(@Param("user") User user, @Param("entityId") String entityId);

    @Modifying
    @Transactional
    @Query("DELETE FROM UserSearchHistory h WHERE h.user = :user AND h.artist.id = :entityId")
    void deleteByUserAndArtistId(@Param("user") User user, @Param("entityId") String entityId);

    @Modifying
    @Transactional
    @Query("DELETE FROM UserSearchHistory h WHERE h.user = :user AND h.playlist.id = :entityId")
    void deleteByUserAndPlaylistId(@Param("user") User user, @Param("entityId") String entityId);

    @Modifying
    @Transactional
    @Query("DELETE FROM UserSearchHistory h WHERE h.user = :user AND h.userPlaylist.id = :entityId")
    void deleteByUserAndUserPlaylistId(@Param("user") User user, @Param("entityId") String entityId);

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

    @Modifying
    @Transactional
    @Query("DELETE FROM UserSearchHistory h WHERE h.userPlaylist = :userPlaylist")
    void deleteByUserPlaylist(@Param("userPlaylist") UserPlaylist userPlaylist);

    @Modifying
    @Transactional
    @Query("DELETE FROM UserSearchHistory h WHERE h.userPlaylist.id = :userPlaylistId")
    void deleteByUserPlaylistId(@Param("userPlaylistId") String userPlaylistId);

    @Modifying
    @Transactional
    @Query("DELETE FROM UserSearchHistory h WHERE h.id = :id AND h.user = :user")
    void deleteByIdAndUser(@Param("id") String id, @Param("user") User user);

    @Modifying
    @Transactional
    @Query("DELETE FROM UserSearchHistory h WHERE h.user = :user")
    void deleteByUser(@Param("user") User user);
}

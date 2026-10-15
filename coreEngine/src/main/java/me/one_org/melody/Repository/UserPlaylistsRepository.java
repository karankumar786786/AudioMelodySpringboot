package me.one_org.melody.Repository;

import me.one_org.melody.Entity.Song;
import me.one_org.melody.Entity.User;
import me.one_org.melody.Entity.UserPlaylist;
import me.one_org.melody.Enums.PlaylistPrivacyEnum;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface UserPlaylistsRepository extends JpaRepository<UserPlaylist, String> {

    Optional<UserPlaylist> findByShareToken(String shareToken);

    @Query("SELECT up FROM UserPlaylist up WHERE up.id = :tokenOrId OR up.shareToken = :tokenOrId")
    List<UserPlaylist> findByIdOrShareTokenList(@Param("tokenOrId") String tokenOrId);

    default Optional<UserPlaylist> findByIdOrShareToken(String tokenOrId) {
        if (tokenOrId == null || tokenOrId.isBlank()) return Optional.empty();
        List<UserPlaylist> list = findByIdOrShareTokenList(tokenOrId);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    @Query("SELECT up FROM UserPlaylist up WHERE up.id IN :ids AND up.privacy = :privacy")
    List<UserPlaylist> findAllPublicByIds(@Param("ids") List<String> ids, @Param("privacy") PlaylistPrivacyEnum privacy);

    default List<UserPlaylist> findAllPublicByIds(List<String> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        return findAllPublicByIds(ids, PlaylistPrivacyEnum.PUBLIC);
    }

    List<UserPlaylist> findByUser(User user);

    @Query("SELECT DISTINCT up FROM UserPlaylist up WHERE up.user = :user " +
           "OR up.id IN (SELECT usp.playlist.id FROM UserSavedPlaylist usp WHERE usp.user = :user) " +
           "ORDER BY up.name ASC, up.id ASC")
    List<UserPlaylist> findByUserPaginatedQuery(@Param("user") User user, Pageable pageable);

    default List<UserPlaylist> findByUserPaginated(User user, int page, int size) {
        return findByUserPaginatedQuery(user, PageRequest.of(page, size));
    }

    @Query("SELECT COUNT(DISTINCT up) FROM UserPlaylist up WHERE up.user = :user " +
           "OR up.id IN (SELECT usp.playlist.id FROM UserSavedPlaylist usp WHERE usp.user = :user)")
    long countByUser(@Param("user") User user);

    @Query("SELECT s FROM UserPlaylist up JOIN up.songs s WHERE up.id = :userPlaylistId ORDER BY s.createdAt DESC")
    List<Song> findSongsByUserPlaylistIdPaginatedQuery(@Param("userPlaylistId") String userPlaylistId, Pageable pageable);

    default List<Song> findSongsByUserPlaylistIdPaginated(String userPlaylistId, int page, int size) {
        return findSongsByUserPlaylistIdPaginatedQuery(userPlaylistId, PageRequest.of(page, size));
    }

    @Modifying
    @Transactional
    @Query(value = "INSERT INTO user_playlist_songs (user_playlist_id, song_id) VALUES (:playlistId, :songId) ON CONFLICT DO NOTHING", nativeQuery = true)
    int insertSongToPlaylist(@Param("playlistId") String playlistId, @Param("songId") String songId);

    @Modifying
    @Transactional
    @Query(value = "UPDATE user_playlists SET total_songs = total_songs + 1 WHERE id = :playlistId", nativeQuery = true)
    int incrementTotalSongs(@Param("playlistId") String playlistId);

    @Modifying
    @Transactional
    @Query(value = "DELETE FROM user_playlist_songs WHERE user_playlist_id = :playlistId AND song_id = :songId", nativeQuery = true)
    int deleteSongFromPlaylist(@Param("playlistId") String playlistId, @Param("songId") String songId);

    @Modifying
    @Transactional
    @Query(value = "UPDATE user_playlists SET total_songs = GREATEST(0, total_songs - 1) WHERE id = :playlistId", nativeQuery = true)
    int decrementTotalSongs(@Param("playlistId") String playlistId);

    @Modifying
    @Transactional
    @Query(value = "DELETE FROM user_playlist_songs WHERE user_playlist_id = :id", nativeQuery = true)
    void deletePlaylistSongs(@Param("id") String id);

    default boolean addSongToPlaylist(String playlistId, String songId) {
        int inserted = insertSongToPlaylist(playlistId, songId);
        if (inserted > 0) {
            incrementTotalSongs(playlistId);
            return true;
        }
        return false;
    }

    default boolean removeSongFromPlaylist(String playlistId, String songId) {
        int deleted = deleteSongFromPlaylist(playlistId, songId);
        if (deleted > 0) {
            decrementTotalSongs(playlistId);
            return true;
        }
        return false;
    }

    @Transactional
    default void deletePlaylistByIdCascade(String id) {
        deletePlaylistSongs(id);
        deleteById(id);
    }
}

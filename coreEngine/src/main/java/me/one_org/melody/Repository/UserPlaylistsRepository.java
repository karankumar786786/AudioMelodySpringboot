package me.one_org.melody.Repository;

import me.one_org.melody.Entity.Song;
import me.one_org.melody.Entity.User;
import me.one_org.melody.Entity.UserPlaylist;
import me.one_org.melody.Enums.PlaylistPrivacyEnum;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Table user_playlists (users ki apni playlists) ke liye queries.
 *
 * Repository = database se baat karne wali layer. Spring Data JPA in interfaces ka code khud bana deta hai:
 * method ka naam (findByEmail) ya @Query likho, SQL Spring chala dega.
 * @EntityGraph = related data (jaise songMetadata) ek hi query me saath laao, alag query (N+1 problem) se bacho.
 * @Modifying = ye query data badalti hai (UPDATE/DELETE), sirf padhti nahi.
 */
public interface UserPlaylistsRepository extends JpaRepository<UserPlaylist, String> {

    /** Id se playlist, owner user ke saath. */
    @Override
    @EntityGraph(attributePaths = {"user"})
    Optional<UserPlaylist> findById(String id);

    /** Share link ke token se playlist. */
    @EntityGraph(attributePaths = {"user"})
    Optional<UserPlaylist> findByShareToken(String shareToken);

    /** Id ya share token - dono me se jo match kare. */
    @EntityGraph(attributePaths = {"user"})
    @Query("SELECT up FROM UserPlaylist up WHERE up.id = :tokenOrId OR up.shareToken = :tokenOrId")
    List<UserPlaylist> findByIdOrShareTokenList(@Param("tokenOrId") String tokenOrId);

    /** Id ya share token se pehli matching playlist. */
    default Optional<UserPlaylist> findByIdOrShareToken(String tokenOrId) {
        if (tokenOrId == null || tokenOrId.isBlank()) return Optional.empty();
        List<UserPlaylist> list = findByIdOrShareTokenList(tokenOrId);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    /** In ids me se sirf diye gaye privacy wali playlists. */
    @EntityGraph(attributePaths = {"user"})
    @Query("SELECT up FROM UserPlaylist up WHERE up.id IN :ids AND up.privacy = :privacy")
    List<UserPlaylist> findAllPublicByIds(@Param("ids") List<String> ids, @Param("privacy") PlaylistPrivacyEnum privacy);

    /** In ids me se sirf PUBLIC playlists (search results me dikhane ke liye). */
    default List<UserPlaylist> findAllPublicByIds(List<String> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        return findAllPublicByIds(ids, PlaylistPrivacyEnum.PUBLIC);
    }

    /** User ki banayi saari playlists. */
    @EntityGraph(attributePaths = {"user"})
    List<UserPlaylist> findByUser(User user);

    /** User ki library: khud ki banayi + save ki hui playlists, naam ke order me. */
    @EntityGraph(attributePaths = {"user"})
    @Query("SELECT DISTINCT up FROM UserPlaylist up WHERE up.user = :user " +
           "OR up.id IN (SELECT usp.playlist.id FROM UserSavedPlaylist usp WHERE usp.user = :user) " +
           "ORDER BY up.name ASC, up.id ASC")
    List<UserPlaylist> findByUserPaginatedQuery(@Param("user") User user, Pageable pageable);

    /** Upar wala, page number + size ke saath. */
    default List<UserPlaylist> findByUserPaginated(User user, int page, int size) {
        return findByUserPaginatedQuery(user, PageRequest.of(page, size));
    }

    /** User ki library me kitni playlists (khud ki + saved). */
    @Query("SELECT COUNT(DISTINCT up) FROM UserPlaylist up WHERE up.user = :user " +
           "OR up.id IN (SELECT usp.playlist.id FROM UserSavedPlaylist usp WHERE usp.user = :user)")
    long countByUser(@Param("user") User user);

    /** Playlist ke songs, naye pehle. */
    @Query("SELECT s FROM UserPlaylist up JOIN up.songs s LEFT JOIN FETCH s.songMetadata WHERE up.id = :userPlaylistId ORDER BY s.createdAt DESC")
    List<Song> findSongsByUserPlaylistIdPaginatedQuery(@Param("userPlaylistId") String userPlaylistId, Pageable pageable);

    /** Upar wala, page number + size ke saath. */
    default List<Song> findSongsByUserPlaylistIdPaginated(String userPlaylistId, int page, int size) {
        return findSongsByUserPlaylistIdPaginatedQuery(userPlaylistId, PageRequest.of(page, size));
    }

    /** Song playlist me jodo. ON CONFLICT DO NOTHING: pehle se hai to kuch mat karo (0 rows). */
    @Modifying
    @Transactional
    @Query(value = "INSERT INTO user_playlist_songs (user_playlist_id, song_id) VALUES (:playlistId, :songId) ON CONFLICT DO NOTHING", nativeQuery = true)
    int insertSongToPlaylist(@Param("playlistId") String playlistId, @Param("songId") String songId);

    /** Playlist ka song count +1. */
    @Modifying
    @Transactional
    @Query(value = "UPDATE user_playlists SET total_songs = total_songs + 1 WHERE id = :playlistId", nativeQuery = true)
    int incrementTotalSongs(@Param("playlistId") String playlistId);

    /** Playlist se song hatao (kitni rows hatin, lautata hai). */
    @Modifying
    @Transactional
    @Query(value = "DELETE FROM user_playlist_songs WHERE user_playlist_id = :playlistId AND song_id = :songId", nativeQuery = true)
    int deleteSongFromPlaylist(@Param("playlistId") String playlistId, @Param("songId") String songId);

    /** Playlist ka song count -1 (0 se neeche nahi). */
    @Modifying
    @Transactional
    @Query(value = "UPDATE user_playlists SET total_songs = GREATEST(0, total_songs - 1) WHERE id = :playlistId", nativeQuery = true)
    int decrementTotalSongs(@Param("playlistId") String playlistId);

    /** Playlist ke saare song links hatao. */
    @Modifying
    @Transactional
    @Query(value = "DELETE FROM user_playlist_songs WHERE user_playlist_id = :id", nativeQuery = true)
    void deletePlaylistSongs(@Param("id") String id);

    /** Song jodo aur count badhao - sirf tab jab sach me naya juda ho. true = juda. */
    default boolean addSongToPlaylist(String playlistId, String songId) {
        int inserted = insertSongToPlaylist(playlistId, songId);
        if (inserted > 0) {
            incrementTotalSongs(playlistId);
            return true;
        }
        return false;
    }

    /** Song hatao aur count ghatao - sirf tab jab sach me hata ho. true = hata. */
    default boolean removeSongFromPlaylist(String playlistId, String songId) {
        int deleted = deleteSongFromPlaylist(playlistId, songId);
        if (deleted > 0) {
            decrementTotalSongs(playlistId);
            return true;
        }
        return false;
    }

    /** Playlist delete: pehle song links, phir playlist - ek transaction me. */
    @Transactional
    default void deletePlaylistByIdCascade(String id) {
        deletePlaylistSongs(id);
        deleteById(id);
    }
}

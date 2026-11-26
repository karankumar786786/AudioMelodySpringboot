package me.one_org.melody.Repository;

import me.one_org.melody.Entity.Playlist;
import me.one_org.melody.Entity.Song;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Table playlists (admin ki official playlists) ke liye queries.
 *
 * Repository = database se baat karne wali layer. Spring Data JPA in interfaces ka code khud bana deta hai:
 * method ka naam (findByEmail) ya @Query likho, SQL Spring chala dega.
 * @EntityGraph = related data (jaise songMetadata) ek hi query me saath laao, alag query (N+1 problem) se bacho.
 * @Modifying = ye query data badalti hai (UPDATE/DELETE), sirf padhti nahi.
 */
public interface PlaylistsRepository extends JpaRepository<Playlist, String> {

    /** Saari playlists, nayi pehle. */
    @Query("SELECT p FROM Playlist p ORDER BY p.createdAt DESC")
    List<Playlist> findAllPaginatedQuery(Pageable pageable);

    /** Page number + size se playlists. */
    default List<Playlist> findAllPaginated(int page, int size) {
        return findAllPaginatedQuery(PageRequest.of(page, size));
    }

    /** Ek playlist ke songs (streams count ke saath), naye pehle. */
    @Query("SELECT s FROM Playlist p JOIN p.songs s LEFT JOIN FETCH s.songMetadata WHERE p.id = :playlistId ORDER BY s.createdAt DESC")
    List<Song> findSongsByPlaylistIdPaginatedQuery(@Param("playlistId") String playlistId, Pageable pageable);

    /** Upar wala, page number + size ke saath. */
    default List<Song> findSongsByPlaylistIdPaginated(String playlistId, int page, int size) {
        return findSongsByPlaylistIdPaginatedQuery(playlistId, PageRequest.of(page, size));
    }

    /** In ids wali saari playlists. */
    List<Playlist> findByIdIn(List<String> ids);

    /** Ids se playlists; khaali list pe query nahi chalti. */
    default List<Playlist> findAllByIds(List<String> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        return findByIdIn(ids);
    }

    /** Playlist ke saare song links (playlist_songs) hatao. */
    @Modifying
    @Transactional
    @Query(value = "DELETE FROM playlist_songs WHERE playlist_id = :id", nativeQuery = true)
    void deletePlaylistSongs(@Param("id") String id);

    /** Playlist delete: pehle song links hatao, phir playlist - ek hi transaction me. */
    @Transactional
    default void deletePlaylistByIdCascade(String id) {
        deletePlaylistSongs(id);
        deleteById(id);
    }
}

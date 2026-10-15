package me.one_org.melody.Repository;

import me.one_org.melody.Entity.Playlist;
import me.one_org.melody.Entity.Song;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface PlaylistsRepository extends JpaRepository<Playlist, String> {

    @Query("SELECT p FROM Playlist p ORDER BY p.createdAt DESC")
    List<Playlist> findAllPaginatedQuery(Pageable pageable);

    default List<Playlist> findAllPaginated(int page, int size) {
        return findAllPaginatedQuery(PageRequest.of(page, size));
    }

    @Query("SELECT s FROM Playlist p JOIN p.songs s WHERE p.id = :playlistId ORDER BY s.createdAt DESC")
    List<Song> findSongsByPlaylistIdPaginatedQuery(@Param("playlistId") String playlistId, Pageable pageable);

    default List<Song> findSongsByPlaylistIdPaginated(String playlistId, int page, int size) {
        return findSongsByPlaylistIdPaginatedQuery(playlistId, PageRequest.of(page, size));
    }

    @Query("SELECT p FROM Playlist p WHERE p.id IN :ids")
    List<Playlist> findAllByIdsQuery(@Param("ids") List<String> ids);

    default List<Playlist> findAllByIds(List<String> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        return findAllByIdsQuery(ids);
    }

    @Modifying
    @Transactional
    @Query(value = "DELETE FROM playlist_songs WHERE playlist_id = :id", nativeQuery = true)
    void deletePlaylistSongs(@Param("id") String id);

    @Transactional
    default void deletePlaylistByIdCascade(String id) {
        deletePlaylistSongs(id);
        deleteById(id);
    }
}

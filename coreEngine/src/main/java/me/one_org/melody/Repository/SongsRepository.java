package me.one_org.melody.Repository;

import me.one_org.melody.Entity.Song;
import me.one_org.melody.Enums.StatusEnum;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

public interface SongsRepository extends JpaRepository<Song, String> {

    List<Song> findByStatus(StatusEnum status);

    @Query("SELECT s FROM Song s LEFT JOIN FETCH s.songMetadata ORDER BY s.createdAt DESC")
    List<Song> findAllPaginatedQuery(Pageable pageable);

    default List<Song> findAllPaginated(int page, int size) {
        return findAllPaginatedQuery(PageRequest.of(page, size));
    }

    @Query("SELECT s FROM Song s LEFT JOIN FETCH s.songMetadata WHERE LOWER(s.title) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(s.artistName) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(s.album) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "ORDER BY s.createdAt DESC")
    List<Song> findAllPaginatedWithSearch(@Param("search") String search, Pageable pageable);

    default List<Song> findAllPaginated(int page, int size, String search) {
        if (search == null || search.trim().isEmpty()) {
            return findAllPaginated(page, size);
        }
        return findAllPaginatedWithSearch(search.trim(), PageRequest.of(page, size));
    }

    @Query("SELECT COUNT(s) FROM Song s WHERE LOWER(s.title) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(s.artistName) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(s.album) LIKE LOWER(CONCAT('%', :search, '%'))")
    long countSongsWithSearch(@Param("search") String search);

    default long countSongs(String search) {
        if (search == null || search.trim().isEmpty()) {
            return count();
        }
        return countSongsWithSearch(search.trim());
    }

    @Query("SELECT h.song FROM UserHistory h " +
           "WHERE h.song.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "GROUP BY h.song " +
           "ORDER BY COUNT(h) DESC")
    List<Song> findTrendingSongs(Pageable pageable);

    @Query("SELECT s FROM Song s LEFT JOIN FETCH s.songMetadata WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE ORDER BY s.createdAt DESC")
    List<Song> findActiveSongs(Pageable pageable);

    @Query("SELECT s FROM Song s LEFT JOIN FETCH s.songMetadata WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE AND s.id NOT IN :existingIds ORDER BY s.createdAt DESC")
    List<Song> findActiveSongsExcluding(@Param("existingIds") List<String> existingIds, Pageable pageable);

    default List<Song> findTrending(int limit) {
        List<Song> trending = findTrendingSongs(PageRequest.of(0, limit));
        if (trending.size() < limit) {
            List<String> existingIds = trending.stream().map(Song::getId).toList();
            int remaining = limit - trending.size();
            List<Song> fallback;
            if (existingIds.isEmpty()) {
                fallback = findActiveSongs(PageRequest.of(0, remaining));
            } else {
                fallback = findActiveSongsExcluding(existingIds, PageRequest.of(0, remaining));
            }
            List<Song> combined = new ArrayList<>(trending);
            combined.addAll(fallback);
            return combined;
        }
        return trending;
    }

    @Query("SELECT s FROM Song s LEFT JOIN FETCH s.songMetadata WHERE s.isFeatured = true AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE ORDER BY s.createdAt DESC")
    List<Song> findFeatured();

    @Query("SELECT COUNT(s) FROM Song s WHERE s.isFeatured = true AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE")
    long countFeatured();

    @Query("SELECT s FROM Song s LEFT JOIN FETCH s.songMetadata WHERE s.id IN :ids")
    List<Song> findAllByIdsQuery(@Param("ids") List<String> ids);

    default List<Song> findAllByIds(List<String> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        return findAllByIdsQuery(ids);
    }

    @Query("SELECT s FROM Song s LEFT JOIN FETCH s.songMetadata WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE AND LOWER(s.artistName) = LOWER(:artistName) ORDER BY s.createdAt DESC")
    List<Song> findActiveByArtistName(@Param("artistName") String artistName, Pageable pageable);

    @Query("SELECT s FROM Song s LEFT JOIN FETCH s.songMetadata WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE AND LOWER(s.artistName) = LOWER(:artistName) AND s.id NOT IN :excluded ORDER BY s.createdAt DESC")
    List<Song> findActiveByArtistNameExcluding(@Param("artistName") String artistName, @Param("excluded") List<String> excluded, Pageable pageable);

    @Query("SELECT s FROM Song s LEFT JOIN FETCH s.songMetadata WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE AND LOWER(s.language) = LOWER(:language) ORDER BY s.createdAt DESC")
    List<Song> findActiveByLanguage(@Param("language") String language, Pageable pageable);

    @Query("SELECT s FROM Song s LEFT JOIN FETCH s.songMetadata WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE AND LOWER(s.language) = LOWER(:language) AND s.id NOT IN :excluded ORDER BY s.createdAt DESC")
    List<Song> findActiveByLanguageExcluding(@Param("language") String language, @Param("excluded") List<String> excluded, Pageable pageable);

    default List<Song> findRadioFallback(String artistName, String language, List<String> excludeIds, int limit) {
        List<Song> results = new ArrayList<>();
        List<String> excluded = excludeIds != null ? new ArrayList<>(excludeIds) : new ArrayList<>();

        if (artistName != null && !artistName.isBlank() && results.size() < limit) {
            int needed = limit - results.size();
            List<Song> artistMatches = excluded.isEmpty()
                    ? findActiveByArtistName(artistName.trim(), PageRequest.of(0, needed))
                    : findActiveByArtistNameExcluding(artistName.trim(), excluded, PageRequest.of(0, needed));
            for (Song s : artistMatches) {
                results.add(s);
                excluded.add(s.getId());
            }
        }

        if (language != null && !language.isBlank() && results.size() < limit) {
            int needed = limit - results.size();
            List<Song> langMatches = excluded.isEmpty()
                    ? findActiveByLanguage(language.trim(), PageRequest.of(0, needed))
                    : findActiveByLanguageExcluding(language.trim(), excluded, PageRequest.of(0, needed));
            for (Song s : langMatches) {
                results.add(s);
                excluded.add(s.getId());
            }
        }

        if (results.size() < limit) {
            int needed = limit - results.size();
            List<Song> generalMatches = excluded.isEmpty()
                    ? findActiveSongs(PageRequest.of(0, needed))
                    : findActiveSongsExcluding(excluded, PageRequest.of(0, needed));
            results.addAll(generalMatches);
        }

        return results;
    }

    @Query("SELECT s FROM Song s LEFT JOIN FETCH s.songMetadata WHERE LOWER(s.album) = LOWER(:album) AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE ORDER BY s.createdAt ASC")
    List<Song> findByAlbum(@Param("album") String album);

    @Query("SELECT s.album, s.artistName, COUNT(s), MIN(s.imageKey), MIN(s.genre) " +
           "FROM Song s " +
           "WHERE s.album IS NOT NULL AND TRIM(s.album) != '' AND s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
           "GROUP BY s.album, s.artistName " +
           "ORDER BY s.album ASC")
    List<Object[]> findDistinctAlbums();

    @Modifying
    @Transactional
    @Query(value = "UPDATE playlists SET total_songs = GREATEST(0, total_songs - 1) WHERE id IN (SELECT playlist_id FROM playlist_songs WHERE song_id = :id)", nativeQuery = true)
    void decrementPlaylistTotalSongs(@Param("id") String id);

    @Modifying
    @Transactional
    @Query(value = "UPDATE user_playlists SET total_songs = GREATEST(0, total_songs - 1) WHERE id IN (SELECT user_playlist_id FROM user_playlist_songs WHERE song_id = :id)", nativeQuery = true)
    void decrementUserPlaylistTotalSongs(@Param("id") String id);

    @Modifying
    @Transactional
    @Query(value = "DELETE FROM playlist_songs WHERE song_id = :id", nativeQuery = true)
    void deletePlaylistSongsBySongId(@Param("id") String id);

    @Modifying
    @Transactional
    @Query(value = "DELETE FROM user_playlist_songs WHERE song_id = :id", nativeQuery = true)
    void deleteUserPlaylistSongsBySongId(@Param("id") String id);

    @Modifying
    @Transactional
    @Query(value = "DELETE FROM user_favourite_songs WHERE song_id = :id", nativeQuery = true)
    void deleteUserFavouriteSongsBySongId(@Param("id") String id);

    @Modifying
    @Transactional
    @Query(value = "DELETE FROM user_history WHERE song_id = :id", nativeQuery = true)
    void deleteUserHistoryBySongId(@Param("id") String id);

    @Transactional
    default void deleteSongCascade(String id) {
        decrementPlaylistTotalSongs(id);
        decrementUserPlaylistTotalSongs(id);
        deletePlaylistSongsBySongId(id);
        deleteUserPlaylistSongsBySongId(id);
        deleteUserFavouriteSongsBySongId(id);
        deleteUserHistoryBySongId(id);
        deleteById(id);
    }
}

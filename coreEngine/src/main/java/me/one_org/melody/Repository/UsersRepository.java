package me.one_org.melody.Repository;

import me.one_org.melody.Entity.Song;
import me.one_org.melody.Entity.User;
import me.one_org.melody.Enums.StatusEnum;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface UsersRepository extends JpaRepository<User, String> {

    boolean existsByEmail(String email);

    Optional<User> findByEmail(String email);

    @Query("SELECT u FROM User u ORDER BY u.createdAt DESC")
    List<User> findAllPaginatedQuery(Pageable pageable);

    default List<User> findAllPaginated(int page, int size) {
        return findAllPaginatedQuery(PageRequest.of(page, size));
    }

    @Query("SELECT u FROM User u WHERE " +
           "(:search IS NULL OR :search = '' OR " +
           " LOWER(u.email) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           " LOWER(u.userName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           " LOWER(u.id) LIKE LOWER(CONCAT('%', :search, '%'))) AND " +
           "(:status IS NULL OR u.status = :status) " +
           "ORDER BY u.createdAt DESC")
    List<User> findFilteredPaginatedQuery(@Param("search") String search, @Param("status") StatusEnum status, Pageable pageable);

    default List<User> findFilteredPaginated(String search, StatusEnum status, int page, int size) {
        return findFilteredPaginatedQuery(search, status, PageRequest.of(page, size));
    }

    @Query("SELECT COUNT(u) FROM User u WHERE " +
           "(:search IS NULL OR :search = '' OR " +
           " LOWER(u.email) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           " LOWER(u.userName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           " LOWER(u.id) LIKE LOWER(CONCAT('%', :search, '%'))) AND " +
           "(:status IS NULL OR u.status = :status)")
    long countFiltered(@Param("search") String search, @Param("status") StatusEnum status);

    @Query(value = "SELECT s.* FROM songs s JOIN user_favourite_songs ufs ON s.id = ufs.song_id WHERE ufs.user_id = :userId ORDER BY s.title ASC",
           nativeQuery = true)
    List<Song> findFavouriteSongsPaginatedNative(@Param("userId") String userId, Pageable pageable);

    default List<Song> findFavouriteSongsPaginated(String userId, int page, int size) {
        return findFavouriteSongsPaginatedNative(userId, PageRequest.of(page, size));
    }

    @Modifying
    @Transactional
    @Query(value = "INSERT INTO user_favourite_songs (user_id, song_id) VALUES (:userId, :songId) ON CONFLICT DO NOTHING", nativeQuery = true)
    int addFavouriteSong(@Param("userId") String userId, @Param("songId") String songId);

    @Modifying
    @Transactional
    @Query(value = "DELETE FROM user_favourite_songs WHERE user_id = :userId AND song_id = :songId", nativeQuery = true)
    int removeFavouriteSong(@Param("userId") String userId, @Param("songId") String songId);

    @Query(value = "SELECT COUNT(*) > 0 FROM user_favourite_songs WHERE user_id = :userId AND song_id = :songId", nativeQuery = true)
    boolean isFavouriteSong(@Param("userId") String userId, @Param("songId") String songId);
}

package me.one_org.melody.Repository;

import me.one_org.melody.Entity.User;
import me.one_org.melody.Entity.UserHistory;
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
 * Table user_history ke liye queries (kisne kab kya suna).
 *
 * Repository = database se baat karne wali layer. Spring Data JPA in interfaces ka code khud bana deta hai:
 * method ka naam (findByEmail) ya @Query likho, SQL Spring chala dega.
 * @EntityGraph = related data (jaise songMetadata) ek hi query me saath laao, alag query (N+1 problem) se bacho.
 * @Modifying = ye query data badalti hai (UPDATE/DELETE), sirf padhti nahi.
 */
public interface UserHistoryRepository extends JpaRepository<UserHistory, String> {

    /** User ki history, naya pehle (song details ke saath). */
    @EntityGraph(attributePaths = {"song", "song.songMetadata"})
    @Query("SELECT h FROM UserHistory h WHERE h.user = :user ORDER BY h.listenedAt DESC")
    List<UserHistory> findByUserOrderByListenedAtDescQuery(@Param("user") User user, Pageable pageable);

    /** Upar wala, page number + size ke saath. */
    default List<UserHistory> findByUserOrderByListenedAtDesc(User user, int page, int size) {
        return findByUserOrderByListenedAtDescQuery(user, PageRequest.of(page, size));
    }

    /** "Recently played": har song sirf ek baar (uska sabse naya play), naya pehle. */
    @EntityGraph(attributePaths = {"song", "song.songMetadata"})
    @Query("SELECT h FROM UserHistory h WHERE h.user = :user " +
           "AND h.listenedAt = (SELECT MAX(h2.listenedAt) FROM UserHistory h2 WHERE h2.user = :user AND h2.song = h.song) " +
           "ORDER BY h.listenedAt DESC")
    List<UserHistory> findRecentByUserQuery(@Param("user") User user, Pageable pageable);

    /** Upar wala, limit ke saath. */
    default List<UserHistory> findRecentByUser(User user, int limit) {
        return findRecentByUserQuery(user, PageRequest.of(0, limit));
    }

    /** User ne kul kitne plays kiye. */
    long countByUser(User user);

    /**
     * User ke baar baar sune gaane (since ke baad, kam se kam minPlays baar).
     * Har row: [songId, playCount, avgCompletion] - zyada plays wale pehle.
     */
    @Query("SELECT h.song.id, COUNT(h) as playCount, AVG(h.part) as avgCompletion " +
           "FROM UserHistory h WHERE h.user = :user " +
           "AND h.listenedAt >= :since " +
           "GROUP BY h.song.id " +
           "HAVING COUNT(h) >= :minPlays " +
           "ORDER BY COUNT(h) DESC, AVG(h.part) DESC")
    List<Object[]> findFrequentlyPlayedSongs(
            @Param("user") User user,
            @Param("since") java.time.LocalDateTime since,
            @Param("minPlays") long minPlays,
            Pageable pageable);

    /** User ki poori history hatao. */
    @Modifying
    @Transactional
    @Query("DELETE FROM UserHistory h WHERE h.user = :user")
    void deleteByUser(@Param("user") User user);
}

package me.one_org.melody.Repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import me.one_org.melody.Entity.Song;
import me.one_org.melody.Entity.UserShortsLike;

/**
 * PURANE canvas-shorts ke likes (table user_shorts_likes). Naye shorts Shorts/ package me hain.
 *
 * Repository = database se baat karne wali layer. Spring Data JPA in interfaces ka code khud bana deta hai:
 * method ka naam (findByEmail) ya @Query likho, SQL Spring chala dega.
 * @EntityGraph = related data (jaise songMetadata) ek hi query me saath laao, alag query (N+1 problem) se bacho.
 * @Modifying = ye query data badalti hai (UPDATE/DELETE), sirf padhti nahi.
 */
public interface UserShortsLikeRepository extends JpaRepository<UserShortsLike, Long> {

    /** User ne is song ka short like kiya hai? */
    @Query("SELECT CASE WHEN COUNT(l) > 0 THEN TRUE ELSE FALSE END FROM UserShortsLike l WHERE l.user.id = :userId AND l.song.id = :songId")
    boolean existsByUserIdAndSongId(@Param("userId") String userId, @Param("songId") String songId);

    /** Is song ke kul likes. */
    @Query("SELECT COUNT(l) FROM UserShortsLike l WHERE l.song.id = :songId")
    long countBySongId(@Param("songId") String songId);

    /** Like hatao (unlike). */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM UserShortsLike l WHERE l.user.id = :userId AND l.song.id = :songId")
    int deleteByUserIdAndSongId(@Param("userId") String userId, @Param("songId") String songId);

    /** User ke liked songs ki ids, naye pehle. */
    @Query("SELECT l.song.id FROM UserShortsLike l WHERE l.user.id = :userId ORDER BY l.createdAt DESC")
    List<String> findLikedSongIdsByUserId(@Param("userId") String userId);

    /** Upar wala, page by page. */
    @Query("SELECT l.song.id FROM UserShortsLike l WHERE l.user.id = :userId ORDER BY l.createdAt DESC")
    Page<String> findLikedSongIdsByUserId(@Param("userId") String userId, Pageable pageable);

    /** User ke liked songs (poori details), page by page. */
    @Query("SELECT l.song FROM UserShortsLike l WHERE l.user.id = :userId ORDER BY l.createdAt DESC")
    Page<Song> findLikedSongsByUserId(@Param("userId") String userId, Pageable pageable);

    /** In songs me se user ne kaunse like kiye - ek query me. */
    @Query("SELECT l.song.id FROM UserShortsLike l WHERE l.user.id = :userId AND l.song.id IN :songIds")
    List<String> findLikedSongIdsByUserIdAndSongIds(@Param("userId") String userId, @Param("songIds") Collection<String> songIds);

    /** Har song ke likes ek saath: [songId, count] rows. */
    @Query("SELECT l.song.id, COUNT(l) FROM UserShortsLike l WHERE l.song.id IN :songIds GROUP BY l.song.id")
    List<Object[]> countLikesBySongIds(@Param("songIds") Collection<String> songIds);
}

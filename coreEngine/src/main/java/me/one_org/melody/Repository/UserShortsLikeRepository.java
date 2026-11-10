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

public interface UserShortsLikeRepository extends JpaRepository<UserShortsLike, Long> {

    @Query("SELECT CASE WHEN COUNT(l) > 0 THEN TRUE ELSE FALSE END FROM UserShortsLike l WHERE l.user.id = :userId AND l.song.id = :songId")
    boolean existsByUserIdAndSongId(@Param("userId") String userId, @Param("songId") String songId);

    @Query("SELECT COUNT(l) FROM UserShortsLike l WHERE l.song.id = :songId")
    long countBySongId(@Param("songId") String songId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM UserShortsLike l WHERE l.user.id = :userId AND l.song.id = :songId")
    int deleteByUserIdAndSongId(@Param("userId") String userId, @Param("songId") String songId);

    @Query("SELECT l.song.id FROM UserShortsLike l WHERE l.user.id = :userId ORDER BY l.createdAt DESC")
    List<String> findLikedSongIdsByUserId(@Param("userId") String userId);

    @Query("SELECT l.song.id FROM UserShortsLike l WHERE l.user.id = :userId ORDER BY l.createdAt DESC")
    Page<String> findLikedSongIdsByUserId(@Param("userId") String userId, Pageable pageable);

    @Query("SELECT l.song FROM UserShortsLike l WHERE l.user.id = :userId ORDER BY l.createdAt DESC")
    Page<Song> findLikedSongsByUserId(@Param("userId") String userId, Pageable pageable);

    @Query("SELECT l.song.id FROM UserShortsLike l WHERE l.user.id = :userId AND l.song.id IN :songIds")
    List<String> findLikedSongIdsByUserIdAndSongIds(@Param("userId") String userId, @Param("songIds") Collection<String> songIds);

    @Query("SELECT l.song.id, COUNT(l) FROM UserShortsLike l WHERE l.song.id IN :songIds GROUP BY l.song.id")
    List<Object[]> countLikesBySongIds(@Param("songIds") Collection<String> songIds);
}

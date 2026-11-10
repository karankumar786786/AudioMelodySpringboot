package me.one_org.melody.Repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import me.one_org.melody.Entity.UserShortsLike;

public interface UserShortsLikeRepository extends JpaRepository<UserShortsLike, Long> {

    @Query("SELECT CASE WHEN COUNT(l) > 0 THEN TRUE ELSE FALSE END FROM UserShortsLike l WHERE l.userId = :userId AND l.song.id = :songId")
    boolean existsByUserIdAndSongId(@Param("userId") String userId, @Param("songId") String songId);

    @Query("SELECT COUNT(l) FROM UserShortsLike l WHERE l.song.id = :songId")
    long countBySongId(@Param("songId") String songId);

    @Modifying
    @Query("DELETE FROM UserShortsLike l WHERE l.userId = :userId AND l.song.id = :songId")
    int deleteByUserIdAndSongId(@Param("userId") String userId, @Param("songId") String songId);

    @Query("SELECT l.song.id FROM UserShortsLike l WHERE l.userId = :userId")
    List<String> findLikedSongIdsByUserId(@Param("userId") String userId);
}

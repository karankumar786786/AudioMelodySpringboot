package me.one_org.melody.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import me.one_org.melody.Entity.Session;

public interface SessionRepository extends JpaRepository<Session, String> {

    Optional<Session> findByUserIdAndDeviceId(String userId, String deviceId);

    Optional<Session> findByRefreshToken(String refreshToken);

    Optional<Session> findByUserIdAndRefreshToken(String userId, String refreshToken);

    @Modifying
    @Query("DELETE FROM Session s WHERE s.user.id = :userId AND s.deviceId = :deviceId")
    void deleteByUserIdAndDeviceId(@Param("userId") String userId, @Param("deviceId") String deviceId);

    @Modifying
    @Query("DELETE FROM Session s WHERE s.refreshToken = :refreshToken")
    void deleteByRefreshToken(@Param("refreshToken") String refreshToken);

    @Modifying
    @Query("DELETE FROM Session s WHERE s.user.id = :userId")
    void deleteByUserId(@Param("userId") String userId);

    @Modifying
    @Query("DELETE FROM Session s WHERE s.expiresAt < :now")
    int deleteExpiredSessions(@Param("now") LocalDateTime now);
}

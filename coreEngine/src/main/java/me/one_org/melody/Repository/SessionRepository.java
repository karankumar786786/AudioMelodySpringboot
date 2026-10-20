package me.one_org.melody.Repository;

import java.time.LocalDateTime;
import java.util.List;
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

    @Query("SELECT s FROM Session s WHERE s.refreshToken = :token OR s.previousRefreshToken = :token")
    Optional<Session> findByCurrentOrPreviousRefreshToken(@Param("token") String token);

    @Query("SELECT s FROM Session s WHERE s.user.id = :userId AND (s.refreshToken = :token OR s.previousRefreshToken = :token)")
    Optional<Session> findByUserIdAndCurrentOrPreviousRefreshToken(@Param("userId") String userId, @Param("token") String token);

    List<Session> findByUserIdOrderByUpdatedAtDesc(String userId);

    @Modifying
    @Query("DELETE FROM Session s WHERE s.user.id = :userId AND s.id = :sessionId")
    int deleteByUserIdAndSessionId(@Param("userId") String userId, @Param("sessionId") String sessionId);

    @Modifying
    @Query("DELETE FROM Session s WHERE s.user.id = :userId AND s.deviceId != :currentDeviceId")
    int deleteByUserIdAndDeviceIdNot(@Param("userId") String userId, @Param("currentDeviceId") String currentDeviceId);

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

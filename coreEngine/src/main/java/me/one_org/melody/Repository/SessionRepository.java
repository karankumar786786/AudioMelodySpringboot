package me.one_org.melody.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import me.one_org.melody.Entity.Session;

/**
 * Table sessions ke liye queries (har device ka login).
 *
 * Repository = database se baat karne wali layer. Spring Data JPA in interfaces ka code khud bana deta hai:
 * method ka naam (findByEmail) ya @Query likho, SQL Spring chala dega.
 * @EntityGraph = related data (jaise songMetadata) ek hi query me saath laao, alag query (N+1 problem) se bacho.
 * @Modifying = ye query data badalti hai (UPDATE/DELETE), sirf padhti nahi.
 */
public interface SessionRepository extends JpaRepository<Session, String> {

    /** User ka is device pe session. */
    Optional<Session> findByUserIdAndDeviceId(String userId, String deviceId);

    /** Refresh token se session (token refresh karte waqt). */
    Optional<Session> findByRefreshToken(String refreshToken);

    /** User + refresh token se session. */
    Optional<Session> findByUserIdAndRefreshToken(String userId, String refreshToken);

    /** User ke saare sessions, haal hi me use hua pehle (Active sessions screen). */
    List<Session> findByUserIdOrderByUpdatedAtDesc(String userId);

    /** User ka ek session hatao (us device se logout). Kitni rows hatin, wo lautata hai. */
    @Modifying
    @Query("DELETE FROM Session s WHERE s.user.id = :userId AND s.id = :sessionId")
    int deleteByUserIdAndSessionId(@Param("userId") String userId, @Param("sessionId") String sessionId);

    /** Is device ko chhod ke user ke baaki saare sessions hatao. */
    @Modifying
    @Query("DELETE FROM Session s WHERE s.user.id = :userId AND s.deviceId != :currentDeviceId")
    int deleteByUserIdAndDeviceIdNot(@Param("userId") String userId, @Param("currentDeviceId") String currentDeviceId);

    /** User ka is device wala session hatao. */
    @Modifying
    @Query("DELETE FROM Session s WHERE s.user.id = :userId AND s.deviceId = :deviceId")
    void deleteByUserIdAndDeviceId(@Param("userId") String userId, @Param("deviceId") String deviceId);

    /** Is refresh token wala session hatao. */
    @Modifying
    @Query("DELETE FROM Session s WHERE s.refreshToken = :refreshToken")
    void deleteByRefreshToken(@Param("refreshToken") String refreshToken);

    /** User ke saare sessions hatao (har device se logout). */
    @Modifying
    @Query("DELETE FROM Session s WHERE s.user.id = :userId")
    void deleteByUserId(@Param("userId") String userId);

    /** Jinka time khatam ho gaya un sessions ko saaf karo (scheduled job chalata hai). */
    @Modifying
    @Query("DELETE FROM Session s WHERE s.expiresAt < :now")
    int deleteExpiredSessions(@Param("now") LocalDateTime now);
}

package me.one_org.melody.Repository;

import me.one_org.melody.Entity.ArtistFollowEvent;
import me.one_org.melody.Enums.FollowEvent;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

/**
 * Table artist_follow_events ke liye queries (follow / unfollow ki history).
 *
 * Repository = database se baat karne wali layer. Spring Data JPA in interfaces ka code khud bana deta hai:
 * method ka naam (findByEmail) ya @Query likho, SQL Spring chala dega.
 * @EntityGraph = related data (jaise songMetadata) ek hi query me saath laao, alag query (N+1 problem) se bacho.
 * @Modifying = ye query data badalti hai (UPDATE/DELETE), sirf padhti nahi.
 */
public interface ArtistFollowEventRepository extends JpaRepository<ArtistFollowEvent, String> {

    /** User aur artist ke beech ke saare follow events, naye pehle (Pageable se sirf pehla le sakte hain). */
    @Query("SELECT e.followEvent FROM ArtistFollowEvent e " +
           "WHERE e.user.id = :userId AND e.artist.id = :artistId " +
           "ORDER BY e.createdAt DESC")
    List<FollowEvent> findLatestFollowEvent(@Param("userId") String userId, @Param("artistId") String artistId, Pageable pageable);

    /**
     * Kya user abhi artist ko follow karta hai?
     * Sabse naya event dekhte hain: FOLLOW hai to haan, UNFOLLOW ya kuch nahi to na.
     */
    default boolean isUserFollowingArtist(String userId, String artistId) {
        if (userId == null || artistId == null) {
            return false;
        }
        List<FollowEvent> events = findLatestFollowEvent(userId, artistId, org.springframework.data.domain.PageRequest.of(0, 1));
        return !events.isEmpty() && events.get(0) == FollowEvent.FOLLOW;
    }
}

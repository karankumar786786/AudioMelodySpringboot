package me.one_org.melody.Repository;

import me.one_org.melody.Entity.ArtistFollowEvent;
import me.one_org.melody.Enums.FollowEvent;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ArtistFollowEventRepository extends JpaRepository<ArtistFollowEvent, String> {

    @Query("SELECT e.followEvent FROM ArtistFollowEvent e " +
           "WHERE e.user.id = :userId AND e.artist.id = :artistId " +
           "ORDER BY e.createdAt DESC")
    List<FollowEvent> findLatestFollowEvent(@Param("userId") String userId, @Param("artistId") String artistId, Pageable pageable);

    default boolean isUserFollowingArtist(String userId, String artistId) {
        if (userId == null || artistId == null) {
            return false;
        }
        List<FollowEvent> events = findLatestFollowEvent(userId, artistId, org.springframework.data.domain.PageRequest.of(0, 1));
        return !events.isEmpty() && events.get(0) == FollowEvent.FOLLOW;
    }
}

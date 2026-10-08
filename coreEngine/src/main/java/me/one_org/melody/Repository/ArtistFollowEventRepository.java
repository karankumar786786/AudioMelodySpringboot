package me.one_org.melody.Repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import me.one_org.melody.Entity.ArtistFollowEventEntity;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public class ArtistFollowEventRepository {

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional
    public void save(ArtistFollowEventEntity event) {
        entityManager.persist(event);
    }

    public boolean isUserFollowingArtist(String userId, String artistId) {
        if (userId == null || artistId == null) {
            return false;
        }
        List<String> list = entityManager.createQuery(
                "SELECT e.eventType FROM ArtistFollowEventEntity e " +
                "WHERE e.userId = :userId AND e.artistId = :artistId " +
                "ORDER BY e.createdAt DESC", String.class)
                .setParameter("userId", userId)
                .setParameter("artistId", artistId)
                .setMaxResults(1)
                .getResultList();
        return !list.isEmpty() && "FOLLOW".equalsIgnoreCase(list.get(0));
    }
}

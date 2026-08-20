package me.one_org.melody.Repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import me.one_org.melody.Entity.SongsEntity;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public class SongsRepository {

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional
    public void save(SongsEntity song) {
        if (entityManager.find(SongsEntity.class, song.getId()) != null) {
            entityManager.merge(song);
        } else {
            entityManager.persist(song);
        }
    }

    public Optional<SongsEntity> findById(String id) {
        return Optional.ofNullable(entityManager.find(SongsEntity.class, id));
    }

    public List<SongsEntity> findAll() {
        return entityManager.createQuery("SELECT s FROM SongsEntity s", SongsEntity.class)
                .getResultList();
    }

    public List<SongsEntity> findAllPaginated(int page, int size) {
        return entityManager.createQuery("SELECT s FROM SongsEntity s ORDER BY s.createdAt DESC", SongsEntity.class)
                .setFirstResult(page * size)
                .setMaxResults(size)
                .getResultList();
    }

    public List<SongsEntity> findTrending(int limit) {
        List<SongsEntity> trending = entityManager.createQuery(
                "SELECT h.song FROM UserHistoryEntity h " +
                "WHERE h.song.status = me.one_org.melody.Enums.StatusEnum.ACTIVE " +
                "GROUP BY h.song " +
                "ORDER BY COUNT(h) DESC", SongsEntity.class)
                .setMaxResults(limit)
                .getResultList();

        if (trending.size() < limit) {
            List<String> existingIds = trending.stream().map(SongsEntity::getId).toList();
            int remaining = limit - trending.size();
            List<SongsEntity> fallback;
            if (existingIds.isEmpty()) {
                fallback = entityManager.createQuery(
                        "SELECT s FROM SongsEntity s WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE ORDER BY s.createdAt DESC",
                        SongsEntity.class)
                        .setMaxResults(remaining)
                        .getResultList();
            } else {
                fallback = entityManager.createQuery(
                        "SELECT s FROM SongsEntity s WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE AND s.id NOT IN :existingIds ORDER BY s.createdAt DESC",
                        SongsEntity.class)
                        .setParameter("existingIds", existingIds)
                        .setMaxResults(remaining)
                        .getResultList();
            }
            List<SongsEntity> combined = new java.util.ArrayList<>(trending);
            combined.addAll(fallback);
            return combined;
        }
        return trending;
    }

    public long count() {
        return entityManager.createQuery("SELECT COUNT(s) FROM SongsEntity s", Long.class)
                .getSingleResult();
    }

    public List<SongsEntity> findAllByIds(List<String> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        return entityManager.createQuery(
                "SELECT s FROM SongsEntity s WHERE s.id IN :ids", SongsEntity.class)
                .setParameter("ids", ids)
                .getResultList();
    }

    @Transactional
    public void deleteById(String id) {
        SongsEntity song = entityManager.find(SongsEntity.class, id);
        if (song != null) {
            // Clean up referencing foreign key records in join & history tables before deleting song
            entityManager.createNativeQuery("DELETE FROM playlist_songs WHERE song_id = :id")
                    .setParameter("id", id)
                    .executeUpdate();
            entityManager.createNativeQuery("DELETE FROM user_playlist_songs WHERE song_id = :id")
                    .setParameter("id", id)
                    .executeUpdate();
            entityManager.createNativeQuery("DELETE FROM user_favourite_songs WHERE song_id = :id")
                    .setParameter("id", id)
                    .executeUpdate();
            entityManager.createNativeQuery("DELETE FROM user_history WHERE song_id = :id")
                    .setParameter("id", id)
                    .executeUpdate();

            entityManager.remove(song);
        }
    }
}

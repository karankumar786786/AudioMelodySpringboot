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
            entityManager.remove(song);
        }
    }
}

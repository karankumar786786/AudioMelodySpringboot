package me.one_org.melody.Repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import me.one_org.melody.Entity.ArtistsEntity;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public class ArtistsRepository {

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional
    public void save(ArtistsEntity artist) {
        if (entityManager.find(ArtistsEntity.class, artist.getId()) != null) {
            entityManager.merge(artist);
        } else {
            entityManager.persist(artist);
        }
    }

    public Optional<ArtistsEntity> findById(String id) {
        return Optional.ofNullable(entityManager.find(ArtistsEntity.class, id));
    }

    public Optional<ArtistsEntity> findByNameIgnoreCase(String name) {
        if (name == null || name.isBlank()) return Optional.empty();
        List<ArtistsEntity> list = entityManager.createQuery(
                "SELECT a FROM ArtistsEntity a WHERE LOWER(TRIM(a.name)) = LOWER(TRIM(:name))", ArtistsEntity.class)
                .setParameter("name", name)
                .setMaxResults(1)
                .getResultList();
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    public List<ArtistsEntity> searchByName(String query, int limit) {
        if (query == null || query.isBlank()) return List.of();
        return entityManager.createQuery(
                "SELECT a FROM ArtistsEntity a WHERE LOWER(a.name) LIKE LOWER(:query) ORDER BY a.name ASC", ArtistsEntity.class)
                .setParameter("query", "%" + query.trim() + "%")
                .setMaxResults(limit)
                .getResultList();
    }

    public List<ArtistsEntity> findAll() {
        return entityManager.createQuery("SELECT a FROM ArtistsEntity a", ArtistsEntity.class)
                .getResultList();
    }

    public List<ArtistsEntity> findAllPaginated(int page, int size) {
        return entityManager.createQuery("SELECT a FROM ArtistsEntity a ORDER BY a.createdAt DESC", ArtistsEntity.class)
                .setFirstResult(page * size)
                .setMaxResults(size)
                .getResultList();
    }

    public long count() {
        return entityManager.createQuery("SELECT COUNT(a) FROM ArtistsEntity a", Long.class)
                .getSingleResult();
    }

    public List<ArtistsEntity> findAllByIds(List<String> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        return entityManager.createQuery(
                "SELECT a FROM ArtistsEntity a WHERE a.id IN :ids", ArtistsEntity.class)
                .setParameter("ids", ids)
                .getResultList();
    }

    @Transactional
    public void deleteById(String id) {
        ArtistsEntity artist = entityManager.find(ArtistsEntity.class, id);
        if (artist != null) {
            entityManager.remove(artist);
        }
    }
}

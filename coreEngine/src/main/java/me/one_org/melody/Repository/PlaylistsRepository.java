package me.one_org.melody.Repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import me.one_org.melody.Entity.PlaylistsEntity;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public class PlaylistsRepository {

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional
    public void save(PlaylistsEntity playlist) {
        if (entityManager.find(PlaylistsEntity.class, playlist.getId()) != null) {
            entityManager.merge(playlist);
        } else {
            entityManager.persist(playlist);
        }
    }

    public Optional<PlaylistsEntity> findById(String id) {
        return Optional.ofNullable(entityManager.find(PlaylistsEntity.class, id));
    }

    public List<PlaylistsEntity> findAll() {
        return entityManager.createQuery("SELECT p FROM PlaylistsEntity p", PlaylistsEntity.class)
                .getResultList();
    }

    public List<PlaylistsEntity> findAllByIds(List<String> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        return entityManager.createQuery(
                "SELECT p FROM PlaylistsEntity p WHERE p.id IN :ids", PlaylistsEntity.class)
                .setParameter("ids", ids)
                .getResultList();
    }

    @Transactional
    public void deleteById(String id) {
        PlaylistsEntity playlist = entityManager.find(PlaylistsEntity.class, id);
        if (playlist != null) {
            entityManager.remove(playlist);
        }
    }
}

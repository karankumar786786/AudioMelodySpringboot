package me.one_org.melody.Repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import me.one_org.melody.Entity.UserPlaylistsEntity;
import me.one_org.melody.Entity.UsersEntity;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public class UserPlaylistsRepository {

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional
    public void save(UserPlaylistsEntity userPlaylist) {
        if (entityManager.find(UserPlaylistsEntity.class, userPlaylist.getId()) != null) {
            entityManager.merge(userPlaylist);
        } else {
            entityManager.persist(userPlaylist);
        }
    }

    public Optional<UserPlaylistsEntity> findById(String id) {
        return Optional.ofNullable(entityManager.find(UserPlaylistsEntity.class, id));
    }

    public List<UserPlaylistsEntity> findByUser(UsersEntity user) {
        return entityManager.createQuery(
                "SELECT up FROM UserPlaylistsEntity up WHERE up.user = :user", UserPlaylistsEntity.class)
                .setParameter("user", user)
                .getResultList();
    }

    public List<UserPlaylistsEntity> findByUserPaginated(UsersEntity user, int page, int size) {
        return entityManager.createQuery(
                "SELECT up FROM UserPlaylistsEntity up WHERE up.user = :user", UserPlaylistsEntity.class)
                .setParameter("user", user)
                .setFirstResult(page * size)
                .setMaxResults(size)
                .getResultList();
    }

    public long countByUser(UsersEntity user) {
        return entityManager.createQuery(
                "SELECT COUNT(up) FROM UserPlaylistsEntity up WHERE up.user = :user", Long.class)
                .setParameter("user", user)
                .getSingleResult();
    }

    public List<me.one_org.melody.Entity.SongsEntity> findSongsByUserPlaylistIdPaginated(String userPlaylistId, int page, int size) {
        return entityManager.createQuery(
                "SELECT s FROM UserPlaylistsEntity up JOIN up.songs s WHERE up.id = :userPlaylistId ORDER BY s.createdAt DESC",
                me.one_org.melody.Entity.SongsEntity.class)
                .setParameter("userPlaylistId", userPlaylistId)
                .setFirstResult(page * size)
                .setMaxResults(size)
                .getResultList();
    }

    @Transactional
    public void deleteById(String id) {
        UserPlaylistsEntity playlist = entityManager.find(UserPlaylistsEntity.class, id);
        if (playlist != null) {
            entityManager.remove(playlist);
        }
    }
}

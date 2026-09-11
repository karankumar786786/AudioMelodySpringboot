package me.one_org.melody.Repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import me.one_org.melody.Entity.UserSearchHistoryEntity;
import me.one_org.melody.Entity.UsersEntity;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public class UserSearchHistoryRepository {

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional
    public void save(UserSearchHistoryEntity history) {
        if (entityManager.find(UserSearchHistoryEntity.class, history.getId()) != null) {
            entityManager.merge(history);
        } else {
            entityManager.persist(history);
        }
    }

    public List<UserSearchHistoryEntity> findByUser(UsersEntity user) {
        return findByUser(user, 20);
    }

    public List<UserSearchHistoryEntity> findByUser(UsersEntity user, int limit) {
        return entityManager.createQuery(
                "SELECT h FROM UserSearchHistoryEntity h " +
                "LEFT JOIN FETCH h.song " +
                "LEFT JOIN FETCH h.artist " +
                "LEFT JOIN FETCH h.playlist " +
                "WHERE h.user = :user ORDER BY h.createdAt DESC",
                UserSearchHistoryEntity.class)
                .setParameter("user", user)
                .setMaxResults(limit)
                .getResultList();
    }

    @Transactional
    public void deleteByUserAndItem(UsersEntity user, String entityType, String entityId) {
        if (entityType == null || entityId == null) return;
        try {
            if ("SONG".equalsIgnoreCase(entityType)) {
                entityManager.createQuery("DELETE FROM UserSearchHistoryEntity h WHERE h.user = :user AND h.song.id = :entityId")
                        .setParameter("user", user)
                        .setParameter("entityId", entityId)
                        .executeUpdate();
            } else if ("ARTIST".equalsIgnoreCase(entityType)) {
                entityManager.createQuery("DELETE FROM UserSearchHistoryEntity h WHERE h.user = :user AND h.artist.id = :entityId")
                        .setParameter("user", user)
                        .setParameter("entityId", entityId)
                        .executeUpdate();
            } else if ("PLAYLIST".equalsIgnoreCase(entityType)) {
                entityManager.createQuery("DELETE FROM UserSearchHistoryEntity h WHERE h.user = :user AND h.playlist.id = :entityId")
                        .setParameter("user", user)
                        .setParameter("entityId", entityId)
                        .executeUpdate();
            }
        } catch (Exception e) {
            // ignore
        }
    }

    @Transactional
    public void deleteByIdAndUser(String id, UsersEntity user) {
        entityManager.createQuery("DELETE FROM UserSearchHistoryEntity h WHERE h.id = :id AND h.user = :user")
                .setParameter("id", id)
                .setParameter("user", user)
                .executeUpdate();
    }

    @Transactional
    public void deleteByUser(UsersEntity user) {
        entityManager.createQuery("DELETE FROM UserSearchHistoryEntity h WHERE h.user = :user")
                .setParameter("user", user)
                .executeUpdate();
    }
}

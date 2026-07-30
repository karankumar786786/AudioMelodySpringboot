package me.one_org.melody.Repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import me.one_org.melody.Entity.UserHistoryEntity;
import me.one_org.melody.Entity.UsersEntity;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public class UserHistoryRepository {

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional
    public void save(UserHistoryEntity history) {
        if (entityManager.find(UserHistoryEntity.class, history.getId()) != null) {
            entityManager.merge(history);
        } else {
            entityManager.persist(history);
        }
    }

    public Optional<UserHistoryEntity> findById(String id) {
        return Optional.ofNullable(entityManager.find(UserHistoryEntity.class, id));
    }

    public List<UserHistoryEntity> findByUserOrderByListenedAtDesc(UsersEntity user, int page, int size) {
        return entityManager.createQuery(
                "SELECT h FROM UserHistoryEntity h WHERE h.user = :user ORDER BY h.listenedAt DESC",
                UserHistoryEntity.class)
                .setParameter("user", user)
                .setFirstResult(page * size)
                .setMaxResults(size)
                .getResultList();
    }

    public long countByUser(UsersEntity user) {
        return entityManager.createQuery(
                "SELECT COUNT(h) FROM UserHistoryEntity h WHERE h.user = :user", Long.class)
                .setParameter("user", user)
                .getSingleResult();
    }

    @Transactional
    public void deleteByUser(UsersEntity user) {
        entityManager.createQuery("DELETE FROM UserHistoryEntity h WHERE h.user = :user")
                .setParameter("user", user)
                .executeUpdate();
    }
}

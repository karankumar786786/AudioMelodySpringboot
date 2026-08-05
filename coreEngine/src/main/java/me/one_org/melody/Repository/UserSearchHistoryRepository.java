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
        return entityManager.createQuery(
                "SELECT h FROM UserSearchHistoryEntity h WHERE h.user = :user ORDER BY h.createdAt DESC",
                UserSearchHistoryEntity.class)
                .setParameter("user", user)
                .setMaxResults(5)
                .getResultList();
    }

    @Transactional
    public void deleteByUser(UsersEntity user) {
        entityManager.createQuery("DELETE FROM UserSearchHistoryEntity h WHERE h.user = :user")
                .setParameter("user", user)
                .executeUpdate();
    }
}

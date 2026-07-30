package me.one_org.melody.Repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import me.one_org.melody.Entity.UsersEntity;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public class UsersRepository {

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional
    public void save(UsersEntity user) {
        if (entityManager.find(UsersEntity.class, user.getId()) != null) {
            entityManager.merge(user);
        } else {
            entityManager.persist(user);
        }
    }

    public Optional<UsersEntity> findById(String id) {
        return Optional.ofNullable(entityManager.find(UsersEntity.class, id));
    }

    public boolean existsById(String id) {
        return entityManager.find(UsersEntity.class, id) != null;
    }

    public boolean existsByEmail(String email) {
        Long count = entityManager.createQuery(
                "SELECT COUNT(u) FROM UsersEntity u WHERE u.email = :email", Long.class)
                .setParameter("email", email)
                .getSingleResult();
        return count > 0;
    }

    public Optional<UsersEntity> findByEmail(String email) {
        List<UsersEntity> results = entityManager.createQuery(
                "SELECT u FROM UsersEntity u WHERE u.email = :email", UsersEntity.class)
                .setParameter("email", email)
                .getResultList();
        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }

    public List<UsersEntity> findAll() {
        return entityManager.createQuery("SELECT u FROM UsersEntity u", UsersEntity.class)
                .getResultList();
    }

    @Transactional
    public void deleteById(String id) {
        UsersEntity user = entityManager.find(UsersEntity.class, id);
        if (user != null) {
            entityManager.remove(user);
        }
    }
}

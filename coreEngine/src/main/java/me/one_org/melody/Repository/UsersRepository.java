package me.one_org.melody.Repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import me.one_org.melody.Entity.UsersEntity;
import me.one_org.melody.Enums.RoleEnum;
import me.one_org.melody.Enums.StatusEnum;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
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

    public List<UsersEntity> findAllPaginated(int page, int size) {
        return entityManager.createQuery("SELECT u FROM UsersEntity u ORDER BY u.createdAt DESC", UsersEntity.class)
                .setFirstResult(page * size)
                .setMaxResults(size)
                .getResultList();
    }

    public long count() {
        return entityManager.createQuery("SELECT COUNT(u) FROM UsersEntity u", Long.class)
                .getSingleResult();
    }

    public List<UsersEntity> findFilteredPaginated(String search, RoleEnum role, StatusEnum status, int page, int size) {
        StringBuilder jpql = new StringBuilder("SELECT u FROM UsersEntity u WHERE 1=1");
        Map<String, Object> params = new HashMap<>();

        if (search != null && !search.trim().isEmpty()) {
            jpql.append(" AND (LOWER(u.email) LIKE :search OR LOWER(u.userName) LIKE :search OR LOWER(u.id) LIKE :search)");
            params.put("search", "%" + search.trim().toLowerCase() + "%");
        }
        if (role != null) {
            jpql.append(" AND u.role = :role");
            params.put("role", role);
        }
        if (status != null) {
            jpql.append(" AND u.status = :status");
            params.put("status", status);
        }

        jpql.append(" ORDER BY u.createdAt DESC");

        TypedQuery<UsersEntity> query = entityManager.createQuery(jpql.toString(), UsersEntity.class);
        params.forEach(query::setParameter);
        query.setFirstResult(page * size);
        query.setMaxResults(size);
        return query.getResultList();
    }

    public long countFiltered(String search, RoleEnum role, StatusEnum status) {
        StringBuilder jpql = new StringBuilder("SELECT COUNT(u) FROM UsersEntity u WHERE 1=1");
        Map<String, Object> params = new HashMap<>();

        if (search != null && !search.trim().isEmpty()) {
            jpql.append(" AND (LOWER(u.email) LIKE :search OR LOWER(u.userName) LIKE :search OR LOWER(u.id) LIKE :search)");
            params.put("search", "%" + search.trim().toLowerCase() + "%");
        }
        if (role != null) {
            jpql.append(" AND u.role = :role");
            params.put("role", role);
        }
        if (status != null) {
            jpql.append(" AND u.status = :status");
            params.put("status", status);
        }

        TypedQuery<Long> query = entityManager.createQuery(jpql.toString(), Long.class);
        params.forEach(query::setParameter);
        return query.getSingleResult();
    }

    public List<me.one_org.melody.Entity.SongsEntity> findFavouriteSongsPaginated(String userId, int page, int size) {
        return entityManager.createQuery(
                "SELECT s FROM UsersEntity u JOIN u.favouriteSongs s WHERE u.id = :userId ORDER BY s.title ASC",
                me.one_org.melody.Entity.SongsEntity.class)
                .setParameter("userId", userId)
                .setFirstResult(page * size)
                .setMaxResults(size)
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

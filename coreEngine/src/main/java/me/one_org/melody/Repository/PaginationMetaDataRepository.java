package me.one_org.melody.Repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import me.one_org.melody.Entity.PaginationMetaDataEntity;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public class PaginationMetaDataRepository {

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional
    public void save(PaginationMetaDataEntity entity) {
        if (entityManager.find(PaginationMetaDataEntity.class, entity.getId()) != null) {
            entityManager.merge(entity);
        } else {
            entityManager.persist(entity);
        }
    }

    public Optional<PaginationMetaDataEntity> findById(String id) {
        return Optional.ofNullable(entityManager.find(PaginationMetaDataEntity.class, id));
    }

    public Optional<PaginationMetaDataEntity> findByEntityName(String entityName) {
        List<PaginationMetaDataEntity> list = entityManager.createQuery(
                "SELECT p FROM PaginationMetaDataEntity p WHERE p.entityName = :entityName",
                PaginationMetaDataEntity.class)
                .setParameter("entityName", entityName)
                .getResultList();
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    public List<PaginationMetaDataEntity> findAll() {
        return entityManager.createQuery("SELECT p FROM PaginationMetaDataEntity p", PaginationMetaDataEntity.class)
                .getResultList();
    }

    @Transactional
    public void deleteByEntityName(String entityName) {
        entityManager.createQuery("DELETE FROM PaginationMetaDataEntity p WHERE p.entityName = :entityName")
                .setParameter("entityName", entityName)
                .executeUpdate();
    }
}

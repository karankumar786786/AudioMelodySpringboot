package me.one_org.melody.Repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import me.one_org.melody.Entity.DeleteJobsEntity;
import me.one_org.melody.Enums.DeleteEntityType;
import me.one_org.melody.Enums.DeleteJobStageEnum;
import me.one_org.melody.Enums.DeleteJobStatusEnum;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public class DeleteJobsRepository {

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional
    public void save(DeleteJobsEntity job) {
        if (entityManager.find(DeleteJobsEntity.class, job.getId()) != null) {
            entityManager.merge(job);
        } else {
            entityManager.persist(job);
        }
    }

    public Optional<DeleteJobsEntity> findById(String id) {
        return Optional.ofNullable(entityManager.find(DeleteJobsEntity.class, id));
    }

    public Optional<DeleteJobsEntity> findLatestByEntity(DeleteEntityType entityType, String entityId) {
        List<DeleteJobsEntity> list = entityManager.createQuery(
                "SELECT d FROM DeleteJobsEntity d WHERE d.entityType = :entityType AND d.entityId = :entityId ORDER BY d.createdAt DESC NULLS LAST", DeleteJobsEntity.class)
                .setParameter("entityType", entityType)
                .setParameter("entityId", entityId)
                .setMaxResults(1)
                .getResultList();
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    public List<DeleteJobsEntity> findAll() {
        return entityManager.createQuery(
                "SELECT d FROM DeleteJobsEntity d ORDER BY d.createdAt DESC NULLS LAST", DeleteJobsEntity.class)
                .getResultList();
    }

    public List<DeleteJobsEntity> findAllPaginated(int page, int size) {
        return entityManager.createQuery(
                "SELECT d FROM DeleteJobsEntity d ORDER BY d.createdAt DESC NULLS LAST", DeleteJobsEntity.class)
                .setFirstResult(page * size)
                .setMaxResults(size)
                .getResultList();
    }

    public long count() {
        return entityManager.createQuery("SELECT COUNT(d) FROM DeleteJobsEntity d", Long.class)
                .getSingleResult();
    }

    public List<DeleteJobsEntity> findByStatus(DeleteJobStatusEnum status) {
        return entityManager.createQuery(
                "SELECT d FROM DeleteJobsEntity d WHERE d.status = :status ORDER BY d.createdAt DESC NULLS LAST", DeleteJobsEntity.class)
                .setParameter("status", status)
                .getResultList();
    }

    public long countByStatus(DeleteJobStatusEnum status) {
        return entityManager.createQuery(
                "SELECT COUNT(d) FROM DeleteJobsEntity d WHERE d.status = :status", Long.class)
                .setParameter("status", status)
                .getSingleResult();
    }

    public long countByStage(DeleteJobStageEnum stage) {
        return entityManager.createQuery(
                "SELECT COUNT(d) FROM DeleteJobsEntity d WHERE d.currentStage = :stage", Long.class)
                .setParameter("stage", stage)
                .getSingleResult();
    }

    public List<DeleteJobsEntity> findActiveProcessing() {
        return findActiveProcessingPaginated(0, 100);
    }

    public List<DeleteJobsEntity> findActiveProcessingPaginated(int page, int size) {
        return entityManager.createQuery(
                "SELECT d FROM DeleteJobsEntity d WHERE d.status IN (:pending, :inProgress) ORDER BY d.createdAt ASC NULLS LAST", DeleteJobsEntity.class)
                .setParameter("pending", DeleteJobStatusEnum.PENDING)
                .setParameter("inProgress", DeleteJobStatusEnum.IN_PROGRESS)
                .setFirstResult(page * size)
                .setMaxResults(size)
                .getResultList();
    }

    public long countActiveProcessing() {
        return entityManager.createQuery(
                "SELECT COUNT(d) FROM DeleteJobsEntity d WHERE d.status IN (:pending, :inProgress)", Long.class)
                .setParameter("pending", DeleteJobStatusEnum.PENDING)
                .setParameter("inProgress", DeleteJobStatusEnum.IN_PROGRESS)
                .getSingleResult();
    }

    public List<DeleteJobsEntity> findPaginatedFiltered(
            DeleteJobStatusEnum status,
            DeleteJobStageEnum stage,
            DeleteEntityType entityType,
            String search,
            int page,
            int size) {
        StringBuilder queryStr = new StringBuilder("SELECT d FROM DeleteJobsEntity d WHERE 1=1 ");
        if (status != null) {
            queryStr.append("AND d.status = :status ");
        }
        if (stage != null) {
            queryStr.append("AND d.currentStage = :stage ");
        }
        if (entityType != null) {
            queryStr.append("AND d.entityType = :entityType ");
        }
        if (search != null && !search.trim().isEmpty()) {
            queryStr.append("AND (LOWER(d.entityTitle) LIKE :search OR LOWER(d.entityId) LIKE :search OR LOWER(d.id) LIKE :search) ");
        }
        queryStr.append("ORDER BY d.createdAt DESC NULLS LAST");

        var query = entityManager.createQuery(queryStr.toString(), DeleteJobsEntity.class);
        if (status != null) {
            query.setParameter("status", status);
        }
        if (stage != null) {
            query.setParameter("stage", stage);
        }
        if (entityType != null) {
            query.setParameter("entityType", entityType);
        }
        if (search != null && !search.trim().isEmpty()) {
            query.setParameter("search", "%" + search.trim().toLowerCase() + "%");
        }

        return query.setFirstResult(page * size)
                .setMaxResults(size)
                .getResultList();
    }

    public long countFiltered(
            DeleteJobStatusEnum status,
            DeleteJobStageEnum stage,
            DeleteEntityType entityType,
            String search) {
        StringBuilder queryStr = new StringBuilder("SELECT COUNT(d) FROM DeleteJobsEntity d WHERE 1=1 ");
        if (status != null) {
            queryStr.append("AND d.status = :status ");
        }
        if (stage != null) {
            queryStr.append("AND d.currentStage = :stage ");
        }
        if (entityType != null) {
            queryStr.append("AND d.entityType = :entityType ");
        }
        if (search != null && !search.trim().isEmpty()) {
            queryStr.append("AND (LOWER(d.entityTitle) LIKE :search OR LOWER(d.entityId) LIKE :search OR LOWER(d.id) LIKE :search) ");
        }

        var query = entityManager.createQuery(queryStr.toString(), Long.class);
        if (status != null) {
            query.setParameter("status", status);
        }
        if (stage != null) {
            query.setParameter("stage", stage);
        }
        if (entityType != null) {
            query.setParameter("entityType", entityType);
        }
        if (search != null && !search.trim().isEmpty()) {
            query.setParameter("search", "%" + search.trim().toLowerCase() + "%");
        }

        return query.getSingleResult();
    }

    public Object[] getAverageDurations() {
        try {
            return (Object[]) entityManager.createQuery(
                    "SELECT AVG(d.searchDurationMs), AVG(d.recommendationDurationMs), " +
                    "AVG(d.imagekitDurationMs), AVG(d.s3DurationMs), AVG(d.finalizeDurationMs), AVG(d.totalDurationMs) " +
                    "FROM DeleteJobsEntity d WHERE d.status = :completed AND d.totalDurationMs IS NOT NULL")
                    .setParameter("completed", DeleteJobStatusEnum.COMPLETED)
                    .getSingleResult();
        } catch (Exception e) {
            return new Object[]{0.0, 0.0, 0.0, 0.0, 0.0, 0.0};
        }
    }

    @Transactional
    public void deleteById(String id) {
        DeleteJobsEntity job = entityManager.find(DeleteJobsEntity.class, id);
        if (job != null) {
            entityManager.remove(job);
        }
    }
}

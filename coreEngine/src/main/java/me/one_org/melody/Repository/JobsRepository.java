package me.one_org.melody.Repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import me.one_org.melody.Entity.JobsEntity;
import me.one_org.melody.Enums.JobStageEnum;
import me.one_org.melody.Enums.JobStatusEnum;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public class JobsRepository {

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional
    public void save(JobsEntity job) {
        if (entityManager.find(JobsEntity.class, job.getId()) != null) {
            entityManager.merge(job);
        } else {
            entityManager.persist(job);
        }
    }

    public Optional<JobsEntity> findById(String id) {
        return Optional.ofNullable(entityManager.find(JobsEntity.class, id));
    }

    public List<JobsEntity> findAll() {
        return entityManager.createQuery("SELECT j FROM JobsEntity j ORDER BY j.createdAt DESC NULLS LAST", JobsEntity.class)
                .getResultList();
    }

    public List<JobsEntity> findAllPaginated(int page, int size) {
        return entityManager.createQuery("SELECT j FROM JobsEntity j ORDER BY j.createdAt DESC NULLS LAST", JobsEntity.class)
                .setFirstResult(page * size)
                .setMaxResults(size)
                .getResultList();
    }

    public long count() {
        return entityManager.createQuery("SELECT COUNT(j) FROM JobsEntity j", Long.class)
                .getSingleResult();
    }

    public List<JobsEntity> findByStatus(JobStatusEnum status) {
        return entityManager.createQuery(
                "SELECT j FROM JobsEntity j WHERE j.status = :status ORDER BY j.createdAt DESC NULLS LAST", JobsEntity.class)
                .setParameter("status", status)
                .getResultList();
    }

    public long countByStatus(JobStatusEnum status) {
        return entityManager.createQuery(
                "SELECT COUNT(j) FROM JobsEntity j WHERE j.status = :status", Long.class)
                .setParameter("status", status)
                .getSingleResult();
    }

    public long countByStage(JobStageEnum stage) {
        return entityManager.createQuery(
                "SELECT COUNT(j) FROM JobsEntity j WHERE j.currentStage = :stage", Long.class)
                .setParameter("stage", stage)
                .getSingleResult();
    }

    public List<JobsEntity> findActiveProcessing() {
        return entityManager.createQuery(
                "SELECT j FROM JobsEntity j WHERE j.status IN (:pending, :processing) ORDER BY j.createdAt ASC NULLS LAST", JobsEntity.class)
                .setParameter("pending", JobStatusEnum.PENDING)
                .setParameter("processing", JobStatusEnum.PROCESSING)
                .getResultList();
    }

    public List<JobsEntity> findPaginatedFiltered(JobStatusEnum status, JobStageEnum stage, int page, int size) {
        StringBuilder queryStr = new StringBuilder("SELECT j FROM JobsEntity j WHERE 1=1 ");
        if (status != null) {
            queryStr.append("AND j.status = :status ");
        }
        if (stage != null) {
            queryStr.append("AND j.currentStage = :stage ");
        }
        queryStr.append("ORDER BY j.createdAt DESC NULLS LAST");

        var query = entityManager.createQuery(queryStr.toString(), JobsEntity.class);
        if (status != null) {
            query.setParameter("status", status);
        }
        if (stage != null) {
            query.setParameter("stage", stage);
        }

        return query.setFirstResult(page * size)
                .setMaxResults(size)
                .getResultList();
    }

    public long countFiltered(JobStatusEnum status, JobStageEnum stage) {
        StringBuilder queryStr = new StringBuilder("SELECT COUNT(j) FROM JobsEntity j WHERE 1=1 ");
        if (status != null) {
            queryStr.append("AND j.status = :status ");
        }
        if (stage != null) {
            queryStr.append("AND j.currentStage = :stage ");
        }

        var query = entityManager.createQuery(queryStr.toString(), Long.class);
        if (status != null) {
            query.setParameter("status", status);
        }
        if (stage != null) {
            query.setParameter("stage", stage);
        }

        return query.getSingleResult();
    }

    public List<JobsEntity> findRecent(int limit) {
        return entityManager.createQuery("SELECT j FROM JobsEntity j ORDER BY j.createdAt DESC NULLS LAST", JobsEntity.class)
                .setMaxResults(limit)
                .getResultList();
    }

    public Object[] getAverageDurations() {
        try {
            return (Object[]) entityManager.createQuery(
                    "SELECT AVG(j.transcodingDurationMs), AVG(j.recommendationDurationMs), " +
                    "AVG(j.searchDurationMs), AVG(j.finalizeDurationMs), AVG(j.totalDurationMs) " +
                    "FROM JobsEntity j WHERE j.status = :completed AND j.totalDurationMs IS NOT NULL")
                    .setParameter("completed", JobStatusEnum.COMPLETED)
                    .getSingleResult();
        } catch (Exception e) {
            return new Object[]{0.0, 0.0, 0.0, 0.0, 0.0};
        }
    }

    @Transactional
    public void deleteById(String id) {
        JobsEntity job = entityManager.find(JobsEntity.class, id);
        if (job != null) {
            entityManager.remove(job);
        }
    }
}

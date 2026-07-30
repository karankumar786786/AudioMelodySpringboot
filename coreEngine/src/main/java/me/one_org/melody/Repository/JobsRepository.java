package me.one_org.melody.Repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import me.one_org.melody.Entity.JobsEntity;
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
        return entityManager.createQuery("SELECT j FROM JobsEntity j", JobsEntity.class)
                .getResultList();
    }

    public List<JobsEntity> findByStatus(JobStatusEnum status) {
        return entityManager.createQuery(
                "SELECT j FROM JobsEntity j WHERE j.status = :status", JobsEntity.class)
                .setParameter("status", status)
                .getResultList();
    }

    @Transactional
    public void deleteById(String id) {
        JobsEntity job = entityManager.find(JobsEntity.class, id);
        if (job != null) {
            entityManager.remove(job);
        }
    }
}

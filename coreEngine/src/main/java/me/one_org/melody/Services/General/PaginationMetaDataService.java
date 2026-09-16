package me.one_org.melody.Services.General;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Enums.DeleteJobStatusEnum;
import me.one_org.melody.Enums.JobStatusEnum;
import me.one_org.melody.Enums.StatusEnum;
import me.one_org.melody.Repository.PaginationMetaDataRepository;

@Service
@Slf4j
public class PaginationMetaDataService {

    private final PaginationMetaDataRepository repository;

    @PersistenceContext
    private EntityManager entityManager;

    public PaginationMetaDataService(PaginationMetaDataRepository repository) {
        this.repository = repository;
    }

    @Cacheable(value = "paginationMetaData", key = "#entityName")
    public PaginationMetaDataEntity getMetaData(String entityName) {
        Optional<PaginationMetaDataEntity> existing = repository.findByEntityName(entityName);

        if (existing.isPresent()) {
            return existing.get();
        } else {
            PaginationMetaDataEntity meta = PaginationMetaDataEntity.builder()
                    .id(UUID.randomUUID().toString())
                    .entityName(entityName)
                    .totalCount(0L)
                    .activeCount(0L)
                    .blockedCount(0L)
                    .deletedCount(0L)
                    .build();
            repository.save(meta);
            return meta;
        }
    }

    @Transactional
    @CacheEvict(value = "paginationMetaData", key = "#entityName")
    public void updateCounts(String entityName, long totalCount, long activeCount, long blockedCount, long deletedCount) {
        Optional<PaginationMetaDataEntity> existing = repository.findByEntityName(entityName);

        PaginationMetaDataEntity meta;
        if (existing.isPresent()) {
            meta = existing.get();
            meta.setTotalCount(totalCount);
            meta.setActiveCount(activeCount);
            meta.setBlockedCount(blockedCount);
            meta.setDeletedCount(deletedCount);
        } else {
            meta = PaginationMetaDataEntity.builder()
                    .id(UUID.randomUUID().toString())
                    .entityName(entityName)
                    .totalCount(totalCount)
                    .activeCount(activeCount)
                    .blockedCount(blockedCount)
                    .deletedCount(deletedCount)
                    .build();
        }
        repository.save(meta);
    }

    @Transactional
    @CacheEvict(value = "paginationMetaData", key = "#entityName")
    public void incrementStatus(String entityName, StatusEnum status) {
        PaginationMetaDataEntity meta = getMetaData(entityName);
        meta.setTotalCount(meta.getTotalCount() + 1);

        StatusEnum currentStatus = status != null ? status : StatusEnum.ACTIVE;
        if (currentStatus == StatusEnum.ACTIVE) {
            meta.setActiveCount(meta.getActiveCount() + 1);
        } else if (currentStatus == StatusEnum.BLOCKED) {
            meta.setBlockedCount(meta.getBlockedCount() + 1);
        } else if (currentStatus == StatusEnum.DELETED) {
            meta.setDeletedCount(meta.getDeletedCount() + 1);
        }

        repository.save(meta);
    }

    @Transactional
    @CacheEvict(value = "paginationMetaData", key = "#entityName")
    public void decrementStatus(String entityName, StatusEnum status) {
        PaginationMetaDataEntity meta = getMetaData(entityName);
        meta.setTotalCount(Math.max(0L, meta.getTotalCount() - 1));

        StatusEnum currentStatus = status != null ? status : StatusEnum.ACTIVE;
        if (currentStatus == StatusEnum.ACTIVE) {
            meta.setActiveCount(Math.max(0L, meta.getActiveCount() - 1));
        } else if (currentStatus == StatusEnum.BLOCKED) {
            meta.setBlockedCount(Math.max(0L, meta.getBlockedCount() - 1));
        } else if (currentStatus == StatusEnum.DELETED) {
            meta.setDeletedCount(Math.max(0L, meta.getDeletedCount() - 1));
        }

        repository.save(meta);
    }

    @Transactional
    @CacheEvict(value = "paginationMetaData", key = "#entityName")
    public void transitionStatus(String entityName, StatusEnum oldStatus, StatusEnum newStatus) {
        if (oldStatus == newStatus) return;

        PaginationMetaDataEntity meta = getMetaData(entityName);

        StatusEnum oldS = oldStatus != null ? oldStatus : StatusEnum.ACTIVE;
        StatusEnum newS = newStatus != null ? newStatus : StatusEnum.ACTIVE;

        if (oldS == StatusEnum.ACTIVE) meta.setActiveCount(Math.max(0L, meta.getActiveCount() - 1));
        else if (oldS == StatusEnum.BLOCKED) meta.setBlockedCount(Math.max(0L, meta.getBlockedCount() - 1));
        else if (oldS == StatusEnum.DELETED) meta.setDeletedCount(Math.max(0L, meta.getDeletedCount() - 1));

        if (newS == StatusEnum.ACTIVE) meta.setActiveCount(meta.getActiveCount() + 1);
        else if (newS == StatusEnum.BLOCKED) meta.setBlockedCount(meta.getBlockedCount() + 1);
        else if (newS == StatusEnum.DELETED) meta.setDeletedCount(meta.getDeletedCount() + 1);

        repository.save(meta);
    }

    /* -------------------------------------------------------------------------
     * JobsEntity Specific Metadata Lifecycle Methods
     * ------------------------------------------------------------------------- */

    @Transactional
    @CacheEvict(value = "paginationMetaData", key = "'JobsEntity'")
    public void incrementJob() {
        PaginationMetaDataEntity meta = getMetaData("JobsEntity");
        meta.setTotalCount(meta.getTotalCount() + 1);
        meta.setActiveCount(meta.getActiveCount() + 1);
        repository.save(meta);
    }

    @Transactional
    @CacheEvict(value = "paginationMetaData", key = "'JobsEntity'")
    public void decrementJob(JobStatusEnum status) {
        PaginationMetaDataEntity meta = getMetaData("JobsEntity");
        meta.setTotalCount(Math.max(0L, meta.getTotalCount() - 1));

        JobStatusEnum currentStatus = status != null ? status : JobStatusEnum.PENDING;
        if (currentStatus == JobStatusEnum.PROCESSING || currentStatus == JobStatusEnum.PENDING) {
            meta.setActiveCount(Math.max(0L, meta.getActiveCount() - 1));
        } else if (currentStatus == JobStatusEnum.FAILED) {
            meta.setBlockedCount(Math.max(0L, meta.getBlockedCount() - 1));
        } else if (currentStatus == JobStatusEnum.COMPLETED) {
            meta.setDeletedCount(Math.max(0L, meta.getDeletedCount() - 1));
        }

        repository.save(meta);
    }

    @Transactional
    @CacheEvict(value = "paginationMetaData", key = "'JobsEntity'")
    public void transitionJob(JobStatusEnum oldStatus, JobStatusEnum newStatus) {
        if (oldStatus == newStatus) return;

        PaginationMetaDataEntity meta = getMetaData("JobsEntity");

        // Remove from previous status count
        if (oldStatus == JobStatusEnum.PROCESSING || oldStatus == JobStatusEnum.PENDING) {
            meta.setActiveCount(Math.max(0L, meta.getActiveCount() - 1));
        } else if (oldStatus == JobStatusEnum.FAILED) {
            meta.setBlockedCount(Math.max(0L, meta.getBlockedCount() - 1));
        } else if (oldStatus == JobStatusEnum.COMPLETED) {
            meta.setDeletedCount(Math.max(0L, meta.getDeletedCount() - 1));
        }

        // Add to new status count
        if (newStatus == JobStatusEnum.PROCESSING || newStatus == JobStatusEnum.PENDING) {
            meta.setActiveCount(meta.getActiveCount() + 1);
        } else if (newStatus == JobStatusEnum.FAILED) {
            meta.setBlockedCount(meta.getBlockedCount() + 1);
        } else if (newStatus == JobStatusEnum.COMPLETED) {
            meta.setDeletedCount(meta.getDeletedCount() + 1);
        }

        repository.save(meta);
    }

    /* -------------------------------------------------------------------------
     * DeleteJobsEntity Specific Metadata Lifecycle Methods
     * ------------------------------------------------------------------------- */

    @Transactional
    @CacheEvict(value = "paginationMetaData", key = "'DeleteJobsEntity'")
    public void incrementDeleteJob() {
        PaginationMetaDataEntity meta = getMetaData("DeleteJobsEntity");
        meta.setTotalCount(meta.getTotalCount() + 1);
        meta.setActiveCount(meta.getActiveCount() + 1);
        repository.save(meta);
    }

    @Transactional
    @CacheEvict(value = "paginationMetaData", key = "'DeleteJobsEntity'")
    public void decrementDeleteJob(DeleteJobStatusEnum status) {
        PaginationMetaDataEntity meta = getMetaData("DeleteJobsEntity");
        meta.setTotalCount(Math.max(0L, meta.getTotalCount() - 1));

        DeleteJobStatusEnum currentStatus = status != null ? status : DeleteJobStatusEnum.PENDING;
        if (currentStatus == DeleteJobStatusEnum.PENDING || currentStatus == DeleteJobStatusEnum.IN_PROGRESS) {
            meta.setActiveCount(Math.max(0L, meta.getActiveCount() - 1));
        } else if (currentStatus == DeleteJobStatusEnum.FAILED) {
            meta.setBlockedCount(Math.max(0L, meta.getBlockedCount() - 1));
        } else if (currentStatus == DeleteJobStatusEnum.COMPLETED) {
            meta.setDeletedCount(Math.max(0L, meta.getDeletedCount() - 1));
        }

        repository.save(meta);
    }

    @Transactional
    @CacheEvict(value = "paginationMetaData", key = "'DeleteJobsEntity'")
    public void transitionDeleteJob(DeleteJobStatusEnum oldStatus, DeleteJobStatusEnum newStatus) {
        if (oldStatus == newStatus) return;

        PaginationMetaDataEntity meta = getMetaData("DeleteJobsEntity");

        if (oldStatus == DeleteJobStatusEnum.PENDING || oldStatus == DeleteJobStatusEnum.IN_PROGRESS) {
            meta.setActiveCount(Math.max(0L, meta.getActiveCount() - 1));
        } else if (oldStatus == DeleteJobStatusEnum.FAILED) {
            meta.setBlockedCount(Math.max(0L, meta.getBlockedCount() - 1));
        } else if (oldStatus == DeleteJobStatusEnum.COMPLETED) {
            meta.setDeletedCount(Math.max(0L, meta.getDeletedCount() - 1));
        }

        if (newStatus == DeleteJobStatusEnum.PENDING || newStatus == DeleteJobStatusEnum.IN_PROGRESS) {
            meta.setActiveCount(meta.getActiveCount() + 1);
        } else if (newStatus == DeleteJobStatusEnum.FAILED) {
            meta.setBlockedCount(meta.getBlockedCount() + 1);
        } else if (newStatus == DeleteJobStatusEnum.COMPLETED) {
            meta.setDeletedCount(meta.getDeletedCount() + 1);
        }

        repository.save(meta);
    }

    /* -------------------------------------------------------------------------
     * Full Database Synchronization
     * ------------------------------------------------------------------------- */

    /**
     * Re-calculates and persists exact counts across all entity tables in PostgreSQL.
     * Clears Redis caches so all pages immediately read synchronized numbers.
     */
    @Transactional
    @CacheEvict(value = "paginationMetaData", allEntries = true)
    public Map<String, PaginationMetaDataEntity> syncAllMetadata() {
        log.info("Starting complete reconciliation of pagination_metadata table...");
        Map<String, PaginationMetaDataEntity> results = new LinkedHashMap<>();

        // 1. SongsEntity
        results.put("SongsEntity", syncEntityCounts("SongsEntity",
                "SELECT COUNT(s) FROM SongsEntity s",
                "SELECT COUNT(s) FROM SongsEntity s WHERE s.status = me.one_org.melody.Enums.StatusEnum.ACTIVE",
                "SELECT COUNT(s) FROM SongsEntity s WHERE s.status = me.one_org.melody.Enums.StatusEnum.BLOCKED",
                "SELECT COUNT(s) FROM SongsEntity s WHERE s.status = me.one_org.melody.Enums.StatusEnum.DELETED"));

        // 2. JobsEntity
        results.put("JobsEntity", syncEntityCounts("JobsEntity",
                "SELECT COUNT(j) FROM JobsEntity j",
                "SELECT COUNT(j) FROM JobsEntity j WHERE j.status = me.one_org.melody.Enums.JobStatusEnum.PROCESSING OR j.status = me.one_org.melody.Enums.JobStatusEnum.PENDING",
                "SELECT COUNT(j) FROM JobsEntity j WHERE j.status = me.one_org.melody.Enums.JobStatusEnum.FAILED",
                "SELECT COUNT(j) FROM JobsEntity j WHERE j.status = me.one_org.melody.Enums.JobStatusEnum.COMPLETED"));

        // 3. UsersEntity
        results.put("UsersEntity", syncEntityCounts("UsersEntity",
                "SELECT COUNT(u) FROM UsersEntity u",
                "SELECT COUNT(u) FROM UsersEntity u WHERE u.status = me.one_org.melody.Enums.StatusEnum.ACTIVE",
                "SELECT COUNT(u) FROM UsersEntity u WHERE u.status = me.one_org.melody.Enums.StatusEnum.BLOCKED",
                "SELECT COUNT(u) FROM UsersEntity u WHERE u.status = me.one_org.melody.Enums.StatusEnum.DELETED"));

        // 4. ArtistsEntity
        results.put("ArtistsEntity", syncEntityCounts("ArtistsEntity",
                "SELECT COUNT(a) FROM ArtistsEntity a",
                "SELECT COUNT(a) FROM ArtistsEntity a WHERE a.status = me.one_org.melody.Enums.StatusEnum.ACTIVE",
                "SELECT COUNT(a) FROM ArtistsEntity a WHERE a.status = me.one_org.melody.Enums.StatusEnum.BLOCKED",
                "SELECT COUNT(a) FROM ArtistsEntity a WHERE a.status = me.one_org.melody.Enums.StatusEnum.DELETED"));

        // 5. PlaylistsEntity
        results.put("PlaylistsEntity", syncEntityCounts("PlaylistsEntity",
                "SELECT COUNT(p) FROM PlaylistsEntity p",
                "SELECT COUNT(p) FROM PlaylistsEntity p WHERE p.status = me.one_org.melody.Enums.StatusEnum.ACTIVE",
                "SELECT COUNT(p) FROM PlaylistsEntity p WHERE p.status = me.one_org.melody.Enums.StatusEnum.BLOCKED",
                "SELECT COUNT(p) FROM PlaylistsEntity p WHERE p.status = me.one_org.melody.Enums.StatusEnum.DELETED"));

        // 6. DeleteJobsEntity
        results.put("DeleteJobsEntity", syncEntityCounts("DeleteJobsEntity",
                "SELECT COUNT(d) FROM DeleteJobsEntity d",
                "SELECT COUNT(d) FROM DeleteJobsEntity d WHERE d.status = me.one_org.melody.Enums.DeleteJobStatusEnum.IN_PROGRESS OR d.status = me.one_org.melody.Enums.DeleteJobStatusEnum.PENDING",
                "SELECT COUNT(d) FROM DeleteJobsEntity d WHERE d.status = me.one_org.melody.Enums.DeleteJobStatusEnum.FAILED",
                "SELECT COUNT(d) FROM DeleteJobsEntity d WHERE d.status = me.one_org.melody.Enums.DeleteJobStatusEnum.COMPLETED"));

        log.info("pagination_metadata table reconciliation complete: {}", results);
        return results;
    }

    private PaginationMetaDataEntity syncEntityCounts(String entityName, String totalQuery, String activeQuery, String blockedQuery, String deletedQuery) {
        long total = entityManager.createQuery(totalQuery, Long.class).getSingleResult();
        long active = entityManager.createQuery(activeQuery, Long.class).getSingleResult();
        long blocked = entityManager.createQuery(blockedQuery, Long.class).getSingleResult();
        long deleted = entityManager.createQuery(deletedQuery, Long.class).getSingleResult();

        updateCounts(entityName, total, active, blocked, deleted);
        return getMetaData(entityName);
    }

    /**
     * Automatic sync on application startup.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        try {
            syncAllMetadata();
        } catch (Exception e) {
            log.error("Failed to auto-sync pagination_metadata table on startup: {}", e.getMessage());
        }
    }
}

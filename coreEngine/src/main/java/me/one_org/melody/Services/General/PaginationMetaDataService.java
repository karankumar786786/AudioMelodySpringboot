package me.one_org.melody.Services.General;

import java.util.Optional;
import java.util.UUID;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Enums.StatusEnum;
import me.one_org.melody.Repository.PaginationMetaDataRepository;

@Service
public class PaginationMetaDataService {

    private final PaginationMetaDataRepository repository;

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
}

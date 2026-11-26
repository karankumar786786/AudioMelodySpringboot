package me.one_org.melody.Dto.Controllers.Api;

import java.time.LocalDateTime;
import me.one_org.melody.Entity.PaginationMetaData;

/**
 * Pagination ke counts (total / active / blocked / deleted) API response ke liye.
 */
public record PaginationMetaDataDto(
    String id,
    String tableName,
    long totalCount,
    long activeCount,
    long blockedCount,
    long deletedCount,
    LocalDateTime updatedAt
) {
    public static PaginationMetaDataDto fromEntity(PaginationMetaData meta) {
        if (meta == null) return null;
        return new PaginationMetaDataDto(
            meta.getId(),
            meta.getTableName(),
            meta.getTotalCount(),
            meta.getActiveCount(),
            meta.getBlockedCount(),
            meta.getDeletedCount(),
            meta.getUpdatedAt()
        );
    }

    public long softDeletedCount() {
        return this.deletedCount;
    }
}

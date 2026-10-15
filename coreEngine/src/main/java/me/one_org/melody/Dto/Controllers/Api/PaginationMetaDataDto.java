package me.one_org.melody.Dto.Controllers.Api;

import java.time.LocalDateTime;
import me.one_org.melody.Entity.PaginationMetaData;

public record PaginationMetaDataDto(
    String id,
    String tableName,
    long totalCount,
    long activeCount,
    long blockedCount,
    long softDeletedCount,
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
            meta.getSoftDeletedCount(),
            meta.getUpdatedAt()
        );
    }
}

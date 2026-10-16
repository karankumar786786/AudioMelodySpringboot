package me.one_org.melody.Entity;

import jakarta.persistence.*;
import lombok.Builder;
import lombok.Data;

@Entity
@Table(name = "pagination_metadata")
@Data
public class PaginationMetaData {
    @Id
    private String id;

    @Column(name = "entity_name", nullable = false, unique = true)
    private String tableName;

    @Column(name = "total_count", nullable = false)
    private long totalCount;

    @Column(name = "active_count", nullable = false)
    private long activeCount;

    @Column(name = "blocked_count", nullable = false)
    private long blockedCount;

    @Column(name = "deleted_count", nullable = false)
    private long softDeletedCount;

    public PaginationMetaData() {
        super();
    }

    @Builder
    public PaginationMetaData(String id, String tableName, long totalCount, long activeCount,
                              long blockedCount, long softDeletedCount) {
        super();
        this.id = id;
        this.tableName = tableName;
        this.totalCount = totalCount;
        this.activeCount = activeCount;
        this.blockedCount = blockedCount;
        this.softDeletedCount = softDeletedCount;
    }

    public String getEntityName() {
        return this.tableName;
    }

    public void setEntityName(String entityName) {
        this.tableName = entityName;
    }

    public long getDeletedCount() {
        return this.softDeletedCount;
    }

    public void setDeletedCount(long deletedCount) {
        this.softDeletedCount = deletedCount;
    }

    @Transient
    public java.time.LocalDateTime getUpdatedAt() {
        return null;
    }

    public void setUpdatedAt(java.time.LocalDateTime updatedAt) {
        // no-op, column not present in schema
    }
}

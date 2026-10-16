package me.one_org.melody.Entity;

import java.time.LocalDateTime;
import org.hibernate.annotations.UpdateTimestamp;
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
    private long deletedCount;

    @Column(name = "soft_deleted_count", nullable = false)
    private long softDeletedCount;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public PaginationMetaData() {
        super();
    }

    @Builder
    public PaginationMetaData(String id, String tableName, long totalCount, long activeCount,
                              long blockedCount, long deletedCount, long softDeletedCount, LocalDateTime updatedAt) {
        super();
        this.id = id;
        this.tableName = tableName;
        this.totalCount = totalCount;
        this.activeCount = activeCount;
        this.blockedCount = blockedCount;
        this.deletedCount = deletedCount != 0 ? deletedCount : softDeletedCount;
        this.softDeletedCount = softDeletedCount != 0 ? softDeletedCount : deletedCount;
        this.updatedAt = updatedAt != null ? updatedAt : LocalDateTime.now();
    }

    public String getEntityName() {
        return this.tableName;
    }

    public void setEntityName(String entityName) {
        this.tableName = entityName;
    }
}

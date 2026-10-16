package me.one_org.melody.Entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "pagination_metadata")
@Data
public class PaginationMetaData {
    @Id
    private String id;

    @Column(nullable = false, unique = true)
    private String tableName;

    @Column(nullable = false)
    private long totalCount;

    @Column(nullable = false)
    private long activeCount;

    @Column(nullable = false)
    private long blockedCount;

    @Column(nullable = false)
    private long softDeletedCount;

    @UpdateTimestamp 
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    public PaginationMetaData() {
        super();
    }

    @Builder
    public PaginationMetaData(String id, String tableName, long totalCount, long activeCount,
                              long blockedCount, long softDeletedCount, LocalDateTime updatedAt) {
        super();
        this.id = id;
        this.tableName = tableName;
        this.totalCount = totalCount;
        this.activeCount = activeCount;
        this.blockedCount = blockedCount;
        this.softDeletedCount = softDeletedCount;
        this.updatedAt = updatedAt;
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
}

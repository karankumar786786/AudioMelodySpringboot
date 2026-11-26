package me.one_org.melody.Entity;

import java.time.LocalDateTime;
import org.hibernate.annotations.UpdateTimestamp;
import jakarta.persistence.*;
import lombok.Builder;
import lombok.Data;

/**
 * Table: pagination_metadata
 * Har table ke total / active / blocked / deleted rows ka count pehle se gina hua.
 * Pagination me "kul kitne pages" batane ke liye har baar COUNT(*) query nahi chalani padti.
 *
 * Entity = Java class jo database ki ek table se juda hai; har object = table ki ek row.
 * Table Flyway migrations (migration/ module) banate hain, ye class sirf usko map karti hai.
 */
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

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public PaginationMetaData() {
        super();
    }

    @Builder
    public PaginationMetaData(String id, String tableName, long totalCount, long activeCount,
                              long blockedCount, long deletedCount, LocalDateTime updatedAt) {
        super();
        this.id = id;
        this.tableName = tableName;
        this.totalCount = totalCount;
        this.activeCount = activeCount;
        this.blockedCount = blockedCount;
        this.deletedCount = deletedCount;
        this.updatedAt = updatedAt != null ? updatedAt : LocalDateTime.now();
    }

    // Column ka naam entity_name hai par field tableName hai - dono naamon se kaam chale isliye ye getter/setter.
    public String getEntityName() {
        return this.tableName;
    }

    public void setEntityName(String entityName) {
        this.tableName = entityName;
    }
}

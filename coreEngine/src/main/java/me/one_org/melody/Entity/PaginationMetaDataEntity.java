package me.one_org.melody.Entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "pagination_metadata")
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class PaginationMetaDataEntity {
    @Id
    private String id;

    @Column(nullable = false, unique = true)
    private String entityName;

    @Column(nullable = false)
    private long totalCount;

    @Column(nullable = false)
    private long activeCount;

    @Column(nullable = false)
    private long blockedCount;

    @Column(nullable = false)
    private long deletedCount;
}

package me.one_org.melody.Entity;

import jakarta.persistence.*;
import lombok.*;
import me.one_org.melody.Enums.DeleteEntityType;
import me.one_org.melody.Enums.DeleteJobStageEnum;
import me.one_org.melody.Enums.DeleteJobStatusEnum;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "delete_jobs")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class DeleteJobsEntity {
    @Id
    private String id;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private DeleteEntityType entityType;

    @Column(nullable = false)
    private String entityId;

    private String entityTitle;
    private String songKey;
    private String imageKey;
    private String coverImageKey;
    private String videoKey;
    private String fullVideoKey;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private DeleteJobStatusEnum status = DeleteJobStatusEnum.PENDING;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private DeleteJobStageEnum currentStage = DeleteJobStageEnum.QUEUED;

    @Column(nullable = false)
    @Builder.Default
    private Integer attemptCount = 0;

    @Column(nullable = false)
    @Builder.Default
    private Integer maxAttempts = 3;

    @Column(columnDefinition = "TEXT")
    private String failureReason;

    private LocalDateTime startedAt;
    private LocalDateTime searchDeletedAt;
    private LocalDateTime recommendationDeletedAt;
    private LocalDateTime imagekitDeletedAt;
    private LocalDateTime s3DeletedAt;
    private LocalDateTime completedAt;
    private LocalDateTime failedAt;

    private Long searchDurationMs;
    private Long recommendationDurationMs;
    private Long imagekitDurationMs;
    private Long s3DurationMs;
    private Long finalizeDurationMs;
    private Long totalDurationMs;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}

package me.one_org.melody.Dto.Controllers.Admin.DeleteJob;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import me.one_org.melody.Enums.DeleteEntityType;
import me.one_org.melody.Enums.DeleteJobStageEnum;
import me.one_org.melody.Enums.DeleteJobStatusEnum;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class DeleteJobProgressDto {
    private String id;
    private DeleteEntityType entityType;
    private String entityId;
    private String entityTitle;
    private String songKey;
    private String imageKey;
    private String coverImageKey;
    private String videoKey;
    private String fullVideoKey;

    private DeleteJobStatusEnum status;
    private DeleteJobStageEnum currentStage;
    private Integer attemptCount;
    private Integer maxAttempts;

    private LocalDateTime createdAt;
    private LocalDateTime startedAt;
    private LocalDateTime searchDeletedAt;
    private LocalDateTime recommendationDeletedAt;
    private LocalDateTime imagekitDeletedAt;
    private LocalDateTime s3DeletedAt;
    private LocalDateTime completedAt;
    private LocalDateTime failedAt;

    private String failureReason;

    private Long searchDurationMs;
    private Long recommendationDurationMs;
    private Long imagekitDurationMs;
    private Long s3DurationMs;
    private Long finalizeDurationMs;
    private Long totalDurationMs;

    private Long elapsedTotalMs;
    private Long currentStageElapsedMs;

    private List<DeleteJobStageDetailDto> stages;
}

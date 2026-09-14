package me.one_org.melody.Dto.Controllers.Admin.Job;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import me.one_org.melody.Enums.JobStageEnum;
import me.one_org.melody.Enums.JobStatusEnum;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class JobProgressDto {
    private String id;
    private String title;
    private String artistName;
    private String songId;
    private String imageKey;
    private String videoKey;
    private String fullVideoKey;
    private Integer duration;

    private JobStatusEnum status;
    private JobStageEnum currentStage;
    private Integer transcodingAttempt;
    private Boolean isVideoReprocess;

    private LocalDateTime createdAt;
    private LocalDateTime transcodingStartedAt;
    private LocalDateTime transcodedAt;
    private LocalDateTime recommendationSavedAt;
    private LocalDateTime searchSavedAt;
    private LocalDateTime completedAt;
    private LocalDateTime failedAt;

    private String failureReason;

    private Long transcodingDurationMs;
    private Long recommendationDurationMs;
    private Long searchDurationMs;
    private Long finalizeDurationMs;
    private Long totalDurationMs;

    private Long elapsedTotalMs;
    private Long currentStageElapsedMs;

    private List<JobStageDetailDto> stages;
}

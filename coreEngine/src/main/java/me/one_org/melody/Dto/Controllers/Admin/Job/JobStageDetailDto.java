package me.one_org.melody.Dto.Controllers.Admin.Job;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class JobStageDetailDto {
    private String stageName;
    private String label;
    private String status; // COMPLETED, IN_PROGRESS, PENDING, FAILED, SKIPPED
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;
    private Long durationMs;
    private String formattedDuration;
}

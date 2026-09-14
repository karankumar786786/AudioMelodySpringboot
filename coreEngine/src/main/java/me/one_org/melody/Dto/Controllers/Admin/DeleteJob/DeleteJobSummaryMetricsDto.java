package me.one_org.melody.Dto.Controllers.Admin.DeleteJob;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class DeleteJobSummaryMetricsDto {
    private long totalJobs;
    private long currentlyProcessing;
    private long pendingQueued;
    private long completed;
    private long failed;

    private Map<String, Long> stageBreakdown;

    private Double avgSearchMs;
    private Double avgRecommendationMs;
    private Double avgImageKitMs;
    private Double avgS3Ms;
    private Double avgFinalizeMs;
    private Double avgTotalMs;

    private Long deleteQueueDepth;
}

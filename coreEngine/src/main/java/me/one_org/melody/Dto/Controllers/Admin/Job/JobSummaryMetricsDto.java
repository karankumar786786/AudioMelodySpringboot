package me.one_org.melody.Dto.Controllers.Admin.Job;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import me.one_org.melody.Dto.Controllers.Admin.Queue.QueueBackpressureSummaryDto;

import java.util.Map;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class JobSummaryMetricsDto {
    private long totalJobs;
    private long currentlyProcessing;
    private long pendingQueued;
    private long completed;
    private long failed;

    private Map<String, Long> stageBreakdown;

    private Double avgTranscodingMs;
    private Double avgRecommendationMs;
    private Double avgSearchMs;
    private Double avgFinalizeMs;
    private Double avgTotalMs;

    private QueueBackpressureSummaryDto queueBackpressure;
}

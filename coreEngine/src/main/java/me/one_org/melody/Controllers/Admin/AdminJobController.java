package me.one_org.melody.Controllers.Admin;

import me.one_org.melody.Dto.Controllers.Admin.Job.JobProgressDto;
import me.one_org.melody.Dto.Controllers.Admin.Job.JobSummaryMetricsDto;
import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Enums.JobStageEnum;
import me.one_org.melody.Enums.JobStatusEnum;
import me.one_org.melody.Services.Admin.JobMonitoringService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/admin/jobs")
public class AdminJobController {

    private final JobMonitoringService jobMonitoringService;

    public AdminJobController(JobMonitoringService jobMonitoringService) {
        this.jobMonitoringService = jobMonitoringService;
    }

    /**
     * High-level summary metrics: currently processing, queued, completed, failed,
     * breakdown by stage, average duration per stage, and queue backpressure.
     */
    @GetMapping("/summary")
    public ResponseEntity<JobSummaryMetricsDto> getSummary() {
        return ResponseEntity.ok(jobMonitoringService.getSummaryMetrics());
    }

    /**
     * Real-time Redis queue depths and backpressure status across all microservice queues.
     */
    @GetMapping("/queues")
    public ResponseEntity<me.one_org.melody.Dto.Controllers.Admin.Queue.QueueBackpressureSummaryDto> getQueues() {
        return ResponseEntity.ok(jobMonitoringService.getQueueBackpressure());
    }

    /**
     * Real-time list of all currently active/processing songs with live stage progress,
     * attempt count, and elapsed timers.
     */
    @GetMapping("/active")
    public ResponseEntity<List<JobProgressDto>> getActiveJobs() {
        return ResponseEntity.ok(jobMonitoringService.getActiveProcessingJobs());
    }

    /**
     * Paginated and filterable list of all song processing jobs.
     */
    @GetMapping
    public ResponseEntity<PaginatedResponseDto<JobProgressDto>> getJobs(
            @RequestParam(required = false) JobStatusEnum status,
            @RequestParam(required = false) JobStageEnum stage,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<JobProgressDto> content = jobMonitoringService.getJobsPaginated(status, stage, page, size);
        long totalCount = jobMonitoringService.countJobs(status, stage);

        PaginationMetaDataEntity meta = new PaginationMetaDataEntity();
        meta.setTotalCount(totalCount);
        meta.setActiveCount(totalCount);
        meta.setBlockedCount(0L);

        return ResponseEntity.ok(new PaginatedResponseDto<>(content, page, size, meta));
    }

    /**
     * Detailed progress, attempts, and webhook timeline for a single job.
     */
    @GetMapping("/{jobId}")
    public ResponseEntity<JobProgressDto> getJobById(@PathVariable String jobId) {
        return ResponseEntity.ok(jobMonitoringService.getJobProgress(jobId));
    }
}

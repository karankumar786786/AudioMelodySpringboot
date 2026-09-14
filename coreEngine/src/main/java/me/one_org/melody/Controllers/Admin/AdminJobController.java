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
import java.util.Map;

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
     * attempt count, and elapsed timers. Supports optional pagination.
     */
    @GetMapping("/active")
    public ResponseEntity<?> getActiveJobs(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        if (page != null && size != null) {
            List<JobProgressDto> content = jobMonitoringService.getActiveProcessingJobsPaginated(page, size);
            long total = jobMonitoringService.countActiveJobs();
            PaginationMetaDataEntity meta = new PaginationMetaDataEntity();
            meta.setTotalCount(total);
            meta.setActiveCount(total);
            meta.setBlockedCount(0L);
            return ResponseEntity.ok(new PaginatedResponseDto<>(content, page, size, meta));
        }
        return ResponseEntity.ok(jobMonitoringService.getActiveProcessingJobs());
    }

    /**
     * Paginated and filterable list of all song processing jobs with search support.
     */
    @GetMapping
    public ResponseEntity<PaginatedResponseDto<JobProgressDto>> getJobs(
            @RequestParam(required = false) JobStatusEnum status,
            @RequestParam(required = false) JobStageEnum stage,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<JobProgressDto> content = jobMonitoringService.getJobsPaginated(status, stage, search, page, size);
        long totalCount = jobMonitoringService.countJobs(status, stage, search);

        PaginationMetaDataEntity meta = new PaginationMetaDataEntity();
        meta.setTotalCount(totalCount);
        meta.setActiveCount(totalCount);
        meta.setBlockedCount(0L);

        return ResponseEntity.ok(new PaginatedResponseDto<>(content, page, size, meta));
    }

    /**
     * Dedicated paginated endpoint for jobs by specific status (e.g. PENDING, PROCESSING, FAILED, COMPLETED).
     */
    @GetMapping("/status/{status}")
    public ResponseEntity<PaginatedResponseDto<JobProgressDto>> getJobsByStatus(
            @PathVariable JobStatusEnum status,
            @RequestParam(required = false) JobStageEnum stage,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return getJobs(status, stage, search, page, size);
    }

    /**
     * Dedicated paginated endpoint for PENDING jobs.
     */
    @GetMapping("/pending")
    public ResponseEntity<PaginatedResponseDto<JobProgressDto>> getPendingJobs(
            @RequestParam(required = false) JobStageEnum stage,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return getJobs(JobStatusEnum.PENDING, stage, search, page, size);
    }

    /**
     * Dedicated paginated endpoint for PROCESSING jobs.
     */
    @GetMapping("/processing")
    public ResponseEntity<PaginatedResponseDto<JobProgressDto>> getProcessingJobs(
            @RequestParam(required = false) JobStageEnum stage,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return getJobs(JobStatusEnum.PROCESSING, stage, search, page, size);
    }

    /**
     * Dedicated paginated endpoint for FAILED jobs.
     */
    @GetMapping("/failed")
    public ResponseEntity<PaginatedResponseDto<JobProgressDto>> getFailedJobs(
            @RequestParam(required = false) JobStageEnum stage,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return getJobs(JobStatusEnum.FAILED, stage, search, page, size);
    }

    /**
     * Dedicated paginated endpoint for COMPLETED jobs.
     */
    @GetMapping("/completed")
    public ResponseEntity<PaginatedResponseDto<JobProgressDto>> getCompletedJobs(
            @RequestParam(required = false) JobStageEnum stage,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return getJobs(JobStatusEnum.COMPLETED, stage, search, page, size);
    }

    /**
     * Detailed progress, attempts, and webhook timeline for a single job.
     */
    @GetMapping("/{jobId}")
    public ResponseEntity<JobProgressDto> getJobById(@PathVariable String jobId) {
        return ResponseEntity.ok(jobMonitoringService.getJobProgress(jobId));
    }

    /**
     * 1-Click retry for a failed or stalled ingestion job. Re-enqueues to audio_processing_queue.
     */
    @PostMapping("/{jobId}/retry")
    public ResponseEntity<JobProgressDto> retryJob(@PathVariable String jobId) {
        return ResponseEntity.ok(jobMonitoringService.retryJob(jobId));
    }

    /**
     * Delete an ingestion job record and cleans up all residual cloud/DB artifacts.
     */
    @DeleteMapping("/{jobId}")
    public ResponseEntity<Void> deleteJob(@PathVariable String jobId) {
        jobMonitoringService.deleteJob(jobId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Bulk purge all FAILED jobs and cleans up all their residual cloud/DB artifacts.
     */
    @DeleteMapping("/failed")
    public ResponseEntity<Map<String, Object>> deleteAllFailedJobs() {
        int count = jobMonitoringService.deleteAllFailedJobs();
        return ResponseEntity.ok(Map.of("success", true, "deletedCount", count));
    }
}

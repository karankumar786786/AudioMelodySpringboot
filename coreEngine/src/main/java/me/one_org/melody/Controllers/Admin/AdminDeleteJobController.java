package me.one_org.melody.Controllers.Admin;

import me.one_org.melody.Dto.Controllers.Admin.DeleteJob.DeleteJobProgressDto;
import me.one_org.melody.Dto.Controllers.Admin.DeleteJob.DeleteJobSummaryMetricsDto;
import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Enums.DeleteEntityType;
import me.one_org.melody.Enums.DeleteJobStageEnum;
import me.one_org.melody.Enums.DeleteJobStatusEnum;
import me.one_org.melody.Services.Admin.AdminDeleteJobService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/admin/delete-jobs")
public class AdminDeleteJobController {

    private final AdminDeleteJobService adminDeleteJobService;

    public AdminDeleteJobController(AdminDeleteJobService adminDeleteJobService) {
        this.adminDeleteJobService = adminDeleteJobService;
    }

    /**
     * High-level summary metrics: total, currently processing, queued, completed, failed,
     * stage breakdown, average stage durations, and delete queue depth.
     */
    @GetMapping("/summary")
    public ResponseEntity<DeleteJobSummaryMetricsDto> getSummary() {
        return ResponseEntity.ok(adminDeleteJobService.getSummaryMetrics());
    }

    /**
     * Real-time list of all currently active/processing delete jobs. Supports optional pagination.
     */
    @GetMapping("/active")
    public ResponseEntity<?> getActiveJobs(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        if (page != null && size != null) {
            List<DeleteJobProgressDto> content = adminDeleteJobService.getActiveProcessingJobsPaginated(page, size);
            long total = adminDeleteJobService.countActiveJobs();
            PaginationMetaDataEntity meta = new PaginationMetaDataEntity();
            meta.setTotalCount(total);
            meta.setActiveCount(total);
            meta.setBlockedCount(0L);
            return ResponseEntity.ok(new PaginatedResponseDto<>(content, page, size, meta));
        }
        return ResponseEntity.ok(adminDeleteJobService.getActiveProcessingJobs());
    }

    /**
     * Paginated and filterable list of all cascade delete jobs.
     */
    @GetMapping
    public ResponseEntity<PaginatedResponseDto<DeleteJobProgressDto>> getJobs(
            @RequestParam(required = false) DeleteJobStatusEnum status,
            @RequestParam(required = false) DeleteJobStageEnum stage,
            @RequestParam(required = false) DeleteEntityType entityType,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<DeleteJobProgressDto> content = adminDeleteJobService.getJobsPaginated(status, stage, entityType, search, page, size);
        long totalCount = adminDeleteJobService.countJobs(status, stage, entityType, search);

        PaginationMetaDataEntity meta = new PaginationMetaDataEntity();
        meta.setTotalCount(totalCount);
        meta.setActiveCount(totalCount);
        meta.setBlockedCount(0L);

        return ResponseEntity.ok(new PaginatedResponseDto<>(content, page, size, meta));
    }

    /**
     * Dedicated paginated endpoint for delete jobs by specific status.
     */
    @GetMapping("/status/{status}")
    public ResponseEntity<PaginatedResponseDto<DeleteJobProgressDto>> getDeleteJobsByStatus(
            @PathVariable DeleteJobStatusEnum status,
            @RequestParam(required = false) DeleteJobStageEnum stage,
            @RequestParam(required = false) DeleteEntityType entityType,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return getJobs(status, stage, entityType, search, page, size);
    }

    /**
     * Dedicated paginated endpoint for PENDING delete jobs.
     */
    @GetMapping("/pending")
    public ResponseEntity<PaginatedResponseDto<DeleteJobProgressDto>> getPendingDeleteJobs(
            @RequestParam(required = false) DeleteJobStageEnum stage,
            @RequestParam(required = false) DeleteEntityType entityType,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return getJobs(DeleteJobStatusEnum.PENDING, stage, entityType, search, page, size);
    }

    /**
     * Dedicated paginated endpoint for IN_PROGRESS delete jobs.
     */
    @GetMapping("/in-progress")
    public ResponseEntity<PaginatedResponseDto<DeleteJobProgressDto>> getInProgressDeleteJobs(
            @RequestParam(required = false) DeleteJobStageEnum stage,
            @RequestParam(required = false) DeleteEntityType entityType,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return getJobs(DeleteJobStatusEnum.IN_PROGRESS, stage, entityType, search, page, size);
    }

    /**
     * Dedicated paginated endpoint for FAILED delete jobs.
     */
    @GetMapping("/failed")
    public ResponseEntity<PaginatedResponseDto<DeleteJobProgressDto>> getFailedDeleteJobs(
            @RequestParam(required = false) DeleteJobStageEnum stage,
            @RequestParam(required = false) DeleteEntityType entityType,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return getJobs(DeleteJobStatusEnum.FAILED, stage, entityType, search, page, size);
    }

    /**
     * Dedicated paginated endpoint for COMPLETED delete jobs.
     */
    @GetMapping("/completed")
    public ResponseEntity<PaginatedResponseDto<DeleteJobProgressDto>> getCompletedDeleteJobs(
            @RequestParam(required = false) DeleteJobStageEnum stage,
            @RequestParam(required = false) DeleteEntityType entityType,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return getJobs(DeleteJobStatusEnum.COMPLETED, stage, entityType, search, page, size);
    }

    /**
     * Detailed progress, attempts, timestamps, and stage breakdown for a single delete job.
     */
    @GetMapping("/{jobId}")
    public ResponseEntity<DeleteJobProgressDto> getJobById(@PathVariable String jobId) {
        return ResponseEntity.ok(adminDeleteJobService.getJobProgress(jobId));
    }

    /**
     * 1-Click retry for a failed delete job. Re-enqueues to delete_event_queue.
     */
    @PostMapping("/{jobId}/retry")
    public ResponseEntity<DeleteJobProgressDto> retryJob(@PathVariable String jobId) {
        return ResponseEntity.ok(adminDeleteJobService.retryJob(jobId));
    }

    /**
     * Delete cascade delete job audit record.
     */
    @DeleteMapping("/{jobId}")
    public ResponseEntity<Void> deleteJob(@PathVariable String jobId) {
        adminDeleteJobService.deleteJob(jobId);
        return ResponseEntity.noContent().build();
    }
}

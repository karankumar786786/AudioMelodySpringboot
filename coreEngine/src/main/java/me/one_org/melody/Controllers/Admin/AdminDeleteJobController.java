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
     * Real-time list of all currently active/processing delete jobs.
     */
    @GetMapping("/active")
    public ResponseEntity<List<DeleteJobProgressDto>> getActiveJobs() {
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
}

package me.one_org.melody.Services.Admin;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Dto.Controllers.Admin.DeleteJob.DeleteJobProgressDto;
import me.one_org.melody.Dto.Controllers.Admin.DeleteJob.DeleteJobStageDetailDto;
import me.one_org.melody.Dto.Controllers.Admin.DeleteJob.DeleteJobSummaryMetricsDto;
import me.one_org.melody.Dto.Queue.DeleteEventQueueDto;
import me.one_org.melody.Entity.DeleteJobsEntity;
import me.one_org.melody.Enums.DeleteEntityType;
import me.one_org.melody.Enums.DeleteJobStageEnum;
import me.one_org.melody.Enums.DeleteJobStatusEnum;
import me.one_org.melody.Exceptions.ResourceNotFoundException;
import me.one_org.melody.Queue.DeleteEventQueue;
import me.one_org.melody.Repository.DeleteJobsRepository;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;

@Service
@Slf4j
public class AdminDeleteJobService {

    private final DeleteJobsRepository deleteJobsRepository;
    private final DeleteEventQueue deleteEventQueue;
    private final QueueMonitoringService queueMonitoringService;

    public AdminDeleteJobService(
            DeleteJobsRepository deleteJobsRepository,
            DeleteEventQueue deleteEventQueue,
            QueueMonitoringService queueMonitoringService) {
        this.deleteJobsRepository = deleteJobsRepository;
        this.deleteEventQueue = deleteEventQueue;
        this.queueMonitoringService = queueMonitoringService;
    }

    public DeleteJobSummaryMetricsDto getSummaryMetrics() {
        long total = deleteJobsRepository.count();
        long processing = deleteJobsRepository.countByStatus(DeleteJobStatusEnum.IN_PROGRESS);
        long pending = deleteJobsRepository.countByStatus(DeleteJobStatusEnum.PENDING);
        long completed = deleteJobsRepository.countByStatus(DeleteJobStatusEnum.COMPLETED);
        long failed = deleteJobsRepository.countByStatus(DeleteJobStatusEnum.FAILED);

        Map<String, Long> stageBreakdown = new LinkedHashMap<>();
        for (DeleteJobStageEnum stage : DeleteJobStageEnum.values()) {
            stageBreakdown.put(stage.name(), deleteJobsRepository.countByStage(stage));
        }

        Object[] avgArray = deleteJobsRepository.getAverageDurations();
        Double avgSearch = avgArray[0] != null ? ((Number) avgArray[0]).doubleValue() : 0.0;
        Double avgRecommendation = avgArray[1] != null ? ((Number) avgArray[1]).doubleValue() : 0.0;
        Double avgImageKit = avgArray[2] != null ? ((Number) avgArray[2]).doubleValue() : 0.0;
        Double avgS3 = avgArray[3] != null ? ((Number) avgArray[3]).doubleValue() : 0.0;
        Double avgFinalize = avgArray[4] != null ? ((Number) avgArray[4]).doubleValue() : 0.0;
        Double avgTotal = avgArray[5] != null ? ((Number) avgArray[5]).doubleValue() : 0.0;

        return DeleteJobSummaryMetricsDto.builder()
                .totalJobs(total)
                .currentlyProcessing(processing)
                .pendingQueued(pending)
                .completed(completed)
                .failed(failed)
                .stageBreakdown(stageBreakdown)
                .avgSearchMs(avgSearch)
                .avgRecommendationMs(avgRecommendation)
                .avgImageKitMs(avgImageKit)
                .avgS3Ms(avgS3)
                .avgFinalizeMs(avgFinalize)
                .avgTotalMs(avgTotal)
                .deleteQueueDepth(queueMonitoringService.getDeleteQueueSize())
                .build();
    }

    public List<DeleteJobProgressDto> getActiveProcessingJobs() {
        List<DeleteJobsEntity> active = deleteJobsRepository.findActiveProcessing();
        return active.stream().map(this::toProgressDto).toList();
    }

    public List<DeleteJobProgressDto> getJobsPaginated(
            DeleteJobStatusEnum status,
            DeleteJobStageEnum stage,
            DeleteEntityType entityType,
            String search,
            int page,
            int size) {
        List<DeleteJobsEntity> jobs = deleteJobsRepository.findPaginatedFiltered(status, stage, entityType, search, page, size);
        return jobs.stream().map(this::toProgressDto).toList();
    }

    public long countJobs(DeleteJobStatusEnum status, DeleteJobStageEnum stage, DeleteEntityType entityType, String search) {
        return deleteJobsRepository.countFiltered(status, stage, entityType, search);
    }

    public DeleteJobProgressDto getJobProgress(String jobId) {
        DeleteJobsEntity job = deleteJobsRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Delete job not found: " + jobId));
        return toProgressDto(job);
    }

    public DeleteJobProgressDto retryJob(String jobId) {
        DeleteJobsEntity job = deleteJobsRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Delete job not found: " + jobId));

        DeleteEventQueueDto dto = new DeleteEventQueueDto(
                job.getId(),
                job.getEntityType(),
                job.getEntityId(),
                job.getEntityTitle(),
                job.getSongKey(),
                job.getImageKey(),
                job.getCoverImageKey(),
                job.getVideoKey(),
                job.getFullVideoKey()
        );

        deleteEventQueue.queueDeleteEvent(dto);
        DeleteJobsEntity updated = deleteJobsRepository.findById(jobId).orElse(job);
        log.info("DeleteJob [{}] re-queued for retry (attempt {})", jobId, updated.getAttemptCount());
        return toProgressDto(updated);
    }

    public DeleteJobProgressDto toProgressDto(DeleteJobsEntity job) {
        LocalDateTime now = LocalDateTime.now();
        DeleteJobStageEnum currentStage = job.getCurrentStage() != null ? job.getCurrentStage() : DeleteJobStageEnum.QUEUED;
        DeleteJobStatusEnum status = job.getStatus() != null ? job.getStatus() : DeleteJobStatusEnum.PENDING;

        Long elapsedTotalMs = job.getTotalDurationMs();
        if (elapsedTotalMs == null && job.getCreatedAt() != null) {
            elapsedTotalMs = Duration.between(job.getCreatedAt(), now).toMillis();
        }

        Long currentStageElapsedMs = null;
        if (status == DeleteJobStatusEnum.IN_PROGRESS || status == DeleteJobStatusEnum.PENDING) {
            LocalDateTime stageStart = switch (currentStage) {
                case QUEUED -> job.getCreatedAt();
                case SEARCH_DELETED -> job.getStartedAt() != null ? job.getStartedAt() : job.getCreatedAt();
                case RECOMMENDATION_DELETED -> job.getSearchDeletedAt() != null ? job.getSearchDeletedAt() : job.getCreatedAt();
                case IMAGEKIT_DELETED -> job.getRecommendationDeletedAt() != null ? job.getRecommendationDeletedAt() : job.getCreatedAt();
                case S3_DELETED -> job.getImagekitDeletedAt() != null ? job.getImagekitDeletedAt() : job.getCreatedAt();
                case COMPLETED -> job.getS3DeletedAt() != null ? job.getS3DeletedAt() : job.getCreatedAt();
                default -> job.getCreatedAt();
            };
            if (stageStart != null) {
                currentStageElapsedMs = Math.max(0, Duration.between(stageStart, now).toMillis());
            }
        }

        List<DeleteJobStageDetailDto> stages = new ArrayList<>();

        // 1. QUEUED
        String qStatus;
        Long qDuration = null;
        if (job.getStartedAt() != null) {
            qStatus = "COMPLETED";
            if (job.getCreatedAt() != null) {
                qDuration = Duration.between(job.getCreatedAt(), job.getStartedAt()).toMillis();
            }
        } else if (status == DeleteJobStatusEnum.FAILED && currentStage == DeleteJobStageEnum.QUEUED) {
            qStatus = "FAILED";
        } else if (status == DeleteJobStatusEnum.PENDING) {
            qStatus = "IN_PROGRESS";
            if (job.getCreatedAt() != null) {
                qDuration = Duration.between(job.getCreatedAt(), now).toMillis();
            }
        } else {
            qStatus = "COMPLETED";
        }
        stages.add(DeleteJobStageDetailDto.builder()
                .stageName("QUEUED")
                .label("Queue & Pickup")
                .status(qStatus)
                .startedAt(job.getCreatedAt())
                .completedAt(job.getStartedAt())
                .durationMs(qDuration)
                .formattedDuration(formatMs(qDuration))
                .build());

        // 2. SEARCH_DELETED
        String sStatus;
        Long sDuration = job.getSearchDurationMs();
        if (job.getSearchDeletedAt() != null) {
            sStatus = "COMPLETED";
        } else if (currentStage == DeleteJobStageEnum.SEARCH_DELETED) {
            sStatus = (status == DeleteJobStatusEnum.FAILED) ? "FAILED" : "IN_PROGRESS";
        } else if (job.getStartedAt() == null) {
            sStatus = "PENDING";
        } else {
            sStatus = (status == DeleteJobStatusEnum.COMPLETED) ? "COMPLETED" : "PENDING";
        }
        stages.add(DeleteJobStageDetailDto.builder()
                .stageName("SEARCH_DELETED")
                .label("Algolia Search Sync")
                .status(sStatus)
                .startedAt(job.getStartedAt())
                .completedAt(job.getSearchDeletedAt())
                .durationMs(sDuration)
                .formattedDuration(formatMs(sDuration))
                .build());

        // 3. RECOMMENDATION_DELETED
        String rStatus;
        Long rDuration = job.getRecommendationDurationMs();
        if (job.getEntityType() != DeleteEntityType.SONG) {
            rStatus = "SKIPPED";
        } else if (job.getRecommendationDeletedAt() != null) {
            rStatus = "COMPLETED";
        } else if (currentStage == DeleteJobStageEnum.RECOMMENDATION_DELETED) {
            rStatus = (status == DeleteJobStatusEnum.FAILED) ? "FAILED" : "IN_PROGRESS";
        } else if (job.getSearchDeletedAt() == null) {
            rStatus = "PENDING";
        } else {
            rStatus = (status == DeleteJobStatusEnum.COMPLETED) ? "COMPLETED" : "PENDING";
        }
        stages.add(DeleteJobStageDetailDto.builder()
                .stageName("RECOMMENDATION_DELETED")
                .label("Recombee Indexing")
                .status(rStatus)
                .startedAt(job.getSearchDeletedAt())
                .completedAt(job.getRecommendationDeletedAt())
                .durationMs(rDuration)
                .formattedDuration(formatMs(rDuration))
                .build());

        // 4. IMAGEKIT_DELETED
        String iStatus;
        Long iDuration = job.getImagekitDurationMs();
        if (job.getImagekitDeletedAt() != null) {
            iStatus = "COMPLETED";
        } else if (currentStage == DeleteJobStageEnum.IMAGEKIT_DELETED) {
            iStatus = (status == DeleteJobStatusEnum.FAILED) ? "FAILED" : "IN_PROGRESS";
        } else if (job.getRecommendationDeletedAt() == null && job.getSearchDeletedAt() == null) {
            iStatus = "PENDING";
        } else {
            iStatus = (status == DeleteJobStatusEnum.COMPLETED) ? "COMPLETED" : "PENDING";
        }
        stages.add(DeleteJobStageDetailDto.builder()
                .stageName("IMAGEKIT_DELETED")
                .label("ImageKit CDN Media")
                .status(iStatus)
                .startedAt(job.getRecommendationDeletedAt() != null ? job.getRecommendationDeletedAt() : job.getSearchDeletedAt())
                .completedAt(job.getImagekitDeletedAt())
                .durationMs(iDuration)
                .formattedDuration(formatMs(iDuration))
                .build());

        // 5. S3_DELETED
        String s3Status;
        Long s3Duration = job.getS3DurationMs();
        if (job.getS3DeletedAt() != null) {
            s3Status = "COMPLETED";
        } else if (currentStage == DeleteJobStageEnum.S3_DELETED) {
            s3Status = (status == DeleteJobStatusEnum.FAILED) ? "FAILED" : "IN_PROGRESS";
        } else if (job.getImagekitDeletedAt() == null) {
            s3Status = "PENDING";
        } else {
            s3Status = (status == DeleteJobStatusEnum.COMPLETED) ? "COMPLETED" : "PENDING";
        }
        stages.add(DeleteJobStageDetailDto.builder()
                .stageName("S3_DELETED")
                .label("S3 Audio & Video Prefix")
                .status(s3Status)
                .startedAt(job.getImagekitDeletedAt())
                .completedAt(job.getS3DeletedAt())
                .durationMs(s3Duration)
                .formattedDuration(formatMs(s3Duration))
                .build());

        // 6. COMPLETED
        String fStatus;
        Long fDuration = job.getFinalizeDurationMs();
        if (status == DeleteJobStatusEnum.COMPLETED) {
            fStatus = "COMPLETED";
        } else if (currentStage == DeleteJobStageEnum.COMPLETED) {
            fStatus = (status == DeleteJobStatusEnum.FAILED) ? "FAILED" : "IN_PROGRESS";
        } else {
            fStatus = (status == DeleteJobStatusEnum.FAILED) ? "FAILED" : "PENDING";
        }
        stages.add(DeleteJobStageDetailDto.builder()
                .stageName("COMPLETED")
                .label("Database Hard Delete")
                .status(fStatus)
                .startedAt(job.getS3DeletedAt() != null ? job.getS3DeletedAt() : job.getImagekitDeletedAt())
                .completedAt(job.getCompletedAt())
                .durationMs(fDuration)
                .formattedDuration(formatMs(fDuration))
                .build());

        return DeleteJobProgressDto.builder()
                .id(job.getId())
                .entityType(job.getEntityType())
                .entityId(job.getEntityId())
                .entityTitle(job.getEntityTitle())
                .songKey(job.getSongKey())
                .imageKey(job.getImageKey())
                .coverImageKey(job.getCoverImageKey())
                .videoKey(job.getVideoKey())
                .fullVideoKey(job.getFullVideoKey())
                .status(status)
                .currentStage(currentStage)
                .attemptCount(job.getAttemptCount() != null ? job.getAttemptCount() : 0)
                .maxAttempts(job.getMaxAttempts() != null ? job.getMaxAttempts() : 3)
                .createdAt(job.getCreatedAt())
                .startedAt(job.getStartedAt())
                .searchDeletedAt(job.getSearchDeletedAt())
                .recommendationDeletedAt(job.getRecommendationDeletedAt())
                .imagekitDeletedAt(job.getImagekitDeletedAt())
                .s3DeletedAt(job.getS3DeletedAt())
                .completedAt(job.getCompletedAt())
                .failedAt(job.getFailedAt())
                .failureReason(job.getFailureReason())
                .searchDurationMs(job.getSearchDurationMs())
                .recommendationDurationMs(job.getRecommendationDurationMs())
                .imagekitDurationMs(job.getImagekitDurationMs())
                .s3DurationMs(job.getS3DurationMs())
                .finalizeDurationMs(job.getFinalizeDurationMs())
                .totalDurationMs(job.getTotalDurationMs())
                .elapsedTotalMs(elapsedTotalMs)
                .currentStageElapsedMs(currentStageElapsedMs)
                .stages(stages)
                .build();
    }

    private String formatMs(Long ms) {
        if (ms == null) return "-";
        if (ms < 1000) return ms + "ms";
        double sec = ms / 1000.0;
        return String.format(Locale.US, "%.1fs", sec);
    }
}

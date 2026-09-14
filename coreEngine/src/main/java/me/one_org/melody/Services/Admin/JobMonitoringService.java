package me.one_org.melody.Services.Admin;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Dto.Controllers.Admin.Job.JobProgressDto;
import me.one_org.melody.Dto.Controllers.Admin.Job.JobStageDetailDto;
import me.one_org.melody.Dto.Controllers.Admin.Job.JobSummaryMetricsDto;
import me.one_org.melody.Entity.JobsEntity;
import me.one_org.melody.Enums.JobStageEnum;
import me.one_org.melody.Enums.JobStatusEnum;
import me.one_org.melody.Exceptions.ResourceNotFoundException;
import me.one_org.melody.Repository.JobsRepository;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;

@Service
@Slf4j
public class JobMonitoringService {

    private final JobsRepository jobsRepository;

    public JobMonitoringService(JobsRepository jobsRepository) {
        this.jobsRepository = jobsRepository;
    }

    public JobSummaryMetricsDto getSummaryMetrics() {
        long total = jobsRepository.count();
        long processing = jobsRepository.countByStatus(JobStatusEnum.PROCESSING);
        long pending = jobsRepository.countByStatus(JobStatusEnum.PENDING);
        long completed = jobsRepository.countByStatus(JobStatusEnum.COMPLETED);
        long failed = jobsRepository.countByStatus(JobStatusEnum.FAILED);

        Map<String, Long> stageBreakdown = new LinkedHashMap<>();
        for (JobStageEnum stage : JobStageEnum.values()) {
            stageBreakdown.put(stage.name(), jobsRepository.countByStage(stage));
        }

        Object[] avgArray = jobsRepository.getAverageDurations();
        Double avgTranscoding = avgArray[0] != null ? ((Number) avgArray[0]).doubleValue() : 0.0;
        Double avgRecommendation = avgArray[1] != null ? ((Number) avgArray[1]).doubleValue() : 0.0;
        Double avgSearch = avgArray[2] != null ? ((Number) avgArray[2]).doubleValue() : 0.0;
        Double avgFinalize = avgArray[3] != null ? ((Number) avgArray[3]).doubleValue() : 0.0;
        Double avgTotal = avgArray[4] != null ? ((Number) avgArray[4]).doubleValue() : 0.0;

        return JobSummaryMetricsDto.builder()
                .totalJobs(total)
                .currentlyProcessing(processing)
                .pendingQueued(pending)
                .completed(completed)
                .failed(failed)
                .stageBreakdown(stageBreakdown)
                .avgTranscodingMs(avgTranscoding)
                .avgRecommendationMs(avgRecommendation)
                .avgSearchMs(avgSearch)
                .avgFinalizeMs(avgFinalize)
                .avgTotalMs(avgTotal)
                .build();
    }

    public List<JobProgressDto> getActiveProcessingJobs() {
        List<JobsEntity> active = jobsRepository.findActiveProcessing();
        return active.stream().map(this::toProgressDto).toList();
    }

    public List<JobProgressDto> getJobsPaginated(JobStatusEnum status, JobStageEnum stage, int page, int size) {
        List<JobsEntity> jobs = jobsRepository.findPaginatedFiltered(status, stage, page, size);
        return jobs.stream().map(this::toProgressDto).toList();
    }

    public long countJobs(JobStatusEnum status, JobStageEnum stage) {
        return jobsRepository.countFiltered(status, stage);
    }

    public JobProgressDto getJobProgress(String jobId) {
        JobsEntity job = jobsRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + jobId));
        return toProgressDto(job);
    }

    public JobProgressDto toProgressDto(JobsEntity job) {
        LocalDateTime now = LocalDateTime.now();
        JobStageEnum currentStage = job.getCurrentStage() != null ? job.getCurrentStage() : JobStageEnum.QUEUED;
        JobStatusEnum status = job.getStatus() != null ? job.getStatus() : JobStatusEnum.PENDING;
        boolean isReprocess = Boolean.TRUE.equals(job.getIsVideoReprocess());

        // Calculate total elapsed time
        Long elapsedTotalMs = job.getTotalDurationMs();
        if (elapsedTotalMs == null && job.getCreatedAt() != null) {
            elapsedTotalMs = Duration.between(job.getCreatedAt(), now).toMillis();
        }

        // Calculate current stage elapsed time
        Long currentStageElapsedMs = null;
        if (status == JobStatusEnum.PROCESSING || status == JobStatusEnum.PENDING) {
            LocalDateTime stageStart = switch (currentStage) {
                case QUEUED -> job.getCreatedAt();
                case TRANSCODING -> job.getTranscodingStartedAt() != null ? job.getTranscodingStartedAt() : job.getCreatedAt();
                case RECOMMENDATION_INDEXING -> job.getTranscodedAt();
                case SEARCH_INDEXING -> job.getRecommendationSavedAt();
                case FINALIZING -> job.getSearchSavedAt() != null ? job.getSearchSavedAt() : job.getTranscodedAt();
                default -> job.getCreatedAt();
            };
            if (stageStart != null) {
                currentStageElapsedMs = Math.max(0, Duration.between(stageStart, now).toMillis());
            }
        }

        List<JobStageDetailDto> stages = new ArrayList<>();

        // 1. QUEUED STAGE
        String qStatus;
        Long qDuration = null;
        if (job.getTranscodingStartedAt() != null) {
            qStatus = "COMPLETED";
            if (job.getCreatedAt() != null) {
                qDuration = Duration.between(job.getCreatedAt(), job.getTranscodingStartedAt()).toMillis();
            }
        } else if (status == JobStatusEnum.FAILED && currentStage == JobStageEnum.QUEUED) {
            qStatus = "FAILED";
        } else if (status == JobStatusEnum.PENDING) {
            qStatus = "IN_PROGRESS";
            if (job.getCreatedAt() != null) {
                qDuration = Duration.between(job.getCreatedAt(), now).toMillis();
            }
        } else {
            qStatus = "COMPLETED";
        }
        stages.add(JobStageDetailDto.builder()
                .stageName("QUEUED")
                .label("Queue & Pickup")
                .status(qStatus)
                .startedAt(job.getCreatedAt())
                .completedAt(job.getTranscodingStartedAt())
                .durationMs(qDuration)
                .formattedDuration(formatMs(qDuration))
                .build());

        // 2. TRANSCODING STAGE
        String tStatus;
        Long tDuration = job.getTranscodingDurationMs();
        if (job.getTranscodedAt() != null) {
            tStatus = "COMPLETED";
        } else if (currentStage == JobStageEnum.TRANSCODING) {
            tStatus = (status == JobStatusEnum.FAILED) ? "FAILED" : "IN_PROGRESS";
            if (tDuration == null && job.getTranscodingStartedAt() != null) {
                tDuration = Duration.between(job.getTranscodingStartedAt(), now).toMillis();
            }
        } else if (job.getTranscodingStartedAt() == null) {
            tStatus = "PENDING";
        } else {
            tStatus = "COMPLETED";
        }
        stages.add(JobStageDetailDto.builder()
                .stageName("TRANSCODING")
                .label("Transcoding & Packaging")
                .status(tStatus)
                .startedAt(job.getTranscodingStartedAt())
                .completedAt(job.getTranscodedAt())
                .durationMs(tDuration)
                .formattedDuration(formatMs(tDuration))
                .build());

        // 3. RECOMMENDATION INDEXING STAGE
        String rStatus;
        Long rDuration = job.getRecommendationDurationMs();
        if (isReprocess) {
            rStatus = "SKIPPED";
        } else if (Boolean.TRUE.equals(job.getSavedInRecommendation())) {
            rStatus = "COMPLETED";
        } else if (currentStage == JobStageEnum.RECOMMENDATION_INDEXING) {
            rStatus = (status == JobStatusEnum.FAILED) ? "FAILED" : "IN_PROGRESS";
            if (rDuration == null && job.getTranscodedAt() != null) {
                rDuration = Duration.between(job.getTranscodedAt(), now).toMillis();
            }
        } else if (job.getTranscodedAt() == null) {
            rStatus = "PENDING";
        } else {
            rStatus = (status == JobStatusEnum.COMPLETED) ? "COMPLETED" : "PENDING";
        }
        stages.add(JobStageDetailDto.builder()
                .stageName("RECOMMENDATION_INDEXING")
                .label("Recombee Indexing")
                .status(rStatus)
                .startedAt(job.getTranscodedAt())
                .completedAt(job.getRecommendationSavedAt())
                .durationMs(rDuration)
                .formattedDuration(formatMs(rDuration))
                .build());

        // 4. SEARCH INDEXING STAGE
        String sStatus;
        Long sDuration = job.getSearchDurationMs();
        if (isReprocess) {
            sStatus = "SKIPPED";
        } else if (Boolean.TRUE.equals(job.getSavedInSearch())) {
            sStatus = "COMPLETED";
        } else if (currentStage == JobStageEnum.SEARCH_INDEXING) {
            sStatus = (status == JobStatusEnum.FAILED) ? "FAILED" : "IN_PROGRESS";
            if (sDuration == null && job.getRecommendationSavedAt() != null) {
                sDuration = Duration.between(job.getRecommendationSavedAt(), now).toMillis();
            }
        } else if (job.getRecommendationSavedAt() == null) {
            sStatus = "PENDING";
        } else {
            sStatus = (status == JobStatusEnum.COMPLETED) ? "COMPLETED" : "PENDING";
        }
        stages.add(JobStageDetailDto.builder()
                .stageName("SEARCH_INDEXING")
                .label("Algolia Search Sync")
                .status(sStatus)
                .startedAt(job.getRecommendationSavedAt())
                .completedAt(job.getSearchSavedAt())
                .durationMs(sDuration)
                .formattedDuration(formatMs(sDuration))
                .build());

        // 5. FINALIZING STAGE
        String fStatus;
        Long fDuration = job.getFinalizeDurationMs();
        if (status == JobStatusEnum.COMPLETED) {
            fStatus = "COMPLETED";
        } else if (currentStage == JobStageEnum.FINALIZING) {
            fStatus = (status == JobStatusEnum.FAILED) ? "FAILED" : "IN_PROGRESS";
            LocalDateTime prev = job.getSearchSavedAt() != null ? job.getSearchSavedAt() : job.getTranscodedAt();
            if (fDuration == null && prev != null) {
                fDuration = Duration.between(prev, now).toMillis();
            }
        } else {
            fStatus = (status == JobStatusEnum.FAILED) ? "FAILED" : "PENDING";
        }
        stages.add(JobStageDetailDto.builder()
                .stageName("FINALIZING")
                .label(isReprocess ? "Update Song Record" : "Finalize & Publish")
                .status(fStatus)
                .startedAt(job.getSearchSavedAt() != null ? job.getSearchSavedAt() : job.getTranscodedAt())
                .completedAt(job.getCompletedAt())
                .durationMs(fDuration)
                .formattedDuration(formatMs(fDuration))
                .build());

        return JobProgressDto.builder()
                .id(job.getId())
                .title(job.getTitle())
                .artistName(job.getArtistName())
                .songId(job.getSongId())
                .imageKey(job.getImageKey())
                .videoKey(job.getVideoKey())
                .fullVideoKey(job.getFullVideoKey())
                .duration(job.getDuration())
                .status(status)
                .currentStage(currentStage)
                .transcodingAttempt(job.getTranscodingAttempt() != null ? job.getTranscodingAttempt() : 0)
                .isVideoReprocess(isReprocess)
                .createdAt(job.getCreatedAt())
                .transcodingStartedAt(job.getTranscodingStartedAt())
                .transcodedAt(job.getTranscodedAt())
                .recommendationSavedAt(job.getRecommendationSavedAt())
                .searchSavedAt(job.getSearchSavedAt())
                .completedAt(job.getCompletedAt())
                .failedAt(job.getFailedAt())
                .failureReason(job.getFailureReason())
                .transcodingDurationMs(job.getTranscodingDurationMs())
                .recommendationDurationMs(job.getRecommendationDurationMs())
                .searchDurationMs(job.getSearchDurationMs())
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

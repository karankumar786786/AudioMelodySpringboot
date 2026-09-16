package me.one_org.melody.Services.Admin;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Dto.Controllers.Admin.Job.JobProgressDto;
import me.one_org.melody.Dto.Controllers.Admin.Job.JobStageDetailDto;
import me.one_org.melody.Dto.Controllers.Admin.Job.JobSummaryMetricsDto;
import me.one_org.melody.Dto.Controllers.Admin.Job.RecoverJobMediaRequestDto;
import me.one_org.melody.Dto.Queue.AudioProcessingQueueDto;
import me.one_org.melody.Entity.JobsEntity;
import me.one_org.melody.Enums.JobStageEnum;
import me.one_org.melody.Enums.JobStatusEnum;
import me.one_org.melody.Enums.StatusEnum;
import me.one_org.melody.Exceptions.ResourceNotFoundException;
import me.one_org.melody.Queue.AudioProcessingQueue;
import me.one_org.melody.Repository.JobsRepository;
import me.one_org.melody.AlgoliaSearch.AlgoliaSearch;
import me.one_org.melody.BlobStorage.S3;
import me.one_org.melody.ImageStorage.ImageKit;
import me.one_org.melody.Recommendation.Recombee;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Services.General.PaginationMetaDataService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;

@Service
@Slf4j
public class JobMonitoringService {

    private final JobsRepository jobsRepository;
    private final SongsRepository songsRepository;
    private final QueueMonitoringService queueMonitoringService;
    private final AudioProcessingQueue audioProcessingQueue;
    private final PaginationMetaDataService paginationMetaDataService;
    private final AlgoliaSearch algoliaSearch;
    private final Recombee recombee;
    private final S3 s3;
    private final ImageKit imageKit;

    @Value("${s3.temp-bucket:melody-temp}")
    private String tempBucket;

    @Value("${s3.production-bucket:melody-songs}")
    private String productionBucket;

    @Value("${audio-processing.api.url:${AUDIO_PROCESSING_URL:http://localhost:5010}}")
    private String audioProcessingUrl;

    @Value("${inngest.dev.url:http://localhost:8288}")
    private String inngestDevUrl;

    public JobMonitoringService(
            JobsRepository jobsRepository,
            SongsRepository songsRepository,
            QueueMonitoringService queueMonitoringService,
            AudioProcessingQueue audioProcessingQueue,
            PaginationMetaDataService paginationMetaDataService,
            AlgoliaSearch algoliaSearch,
            Recombee recombee,
            S3 s3,
            ImageKit imageKit) {
        this.jobsRepository = jobsRepository;
        this.songsRepository = songsRepository;
        this.queueMonitoringService = queueMonitoringService;
        this.audioProcessingQueue = audioProcessingQueue;
        this.paginationMetaDataService = paginationMetaDataService;
        this.algoliaSearch = algoliaSearch;
        this.recombee = recombee;
        this.s3 = s3;
        this.imageKit = imageKit;
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
                .queueBackpressure(queueMonitoringService.getQueueBackpressureSummary())
                .build();
    }

    public me.one_org.melody.Dto.Controllers.Admin.Queue.QueueBackpressureSummaryDto getQueueBackpressure() {
        return queueMonitoringService.getQueueBackpressureSummary();
    }

    public List<JobProgressDto> getActiveProcessingJobs() {
        List<JobsEntity> active = jobsRepository.findActiveProcessing();
        return active.stream().map(this::toProgressDto).toList();
    }

    public List<JobProgressDto> getActiveProcessingJobsPaginated(int page, int size) {
        List<JobsEntity> active = jobsRepository.findActiveProcessingPaginated(page, size);
        return active.stream().map(this::toProgressDto).toList();
    }

    public long countActiveJobs() {
        return jobsRepository.countActiveProcessing();
    }

    public List<JobProgressDto> getJobsPaginated(JobStatusEnum status, JobStageEnum stage, int page, int size) {
        return getJobsPaginated(status, stage, null, page, size);
    }

    public List<JobProgressDto> getJobsPaginated(JobStatusEnum status, JobStageEnum stage, String search, int page, int size) {
        List<JobsEntity> jobs = jobsRepository.findPaginatedFiltered(status, stage, search, page, size);
        return jobs.stream().map(this::toProgressDto).toList();
    }

    public long countJobs(JobStatusEnum status, JobStageEnum stage) {
        return countJobs(status, stage, null);
    }

    public long countJobs(JobStatusEnum status, JobStageEnum stage, String search) {
        return jobsRepository.countFiltered(status, stage, search);
    }

    public List<JobProgressDto> getActiveJobs() {
        return jobsRepository.findActiveProcessing().stream().map(this::toProgressDto).toList();
    }

    public List<JobProgressDto> getJobsByStatus(JobStatusEnum status) {
        return jobsRepository.findByStatus(status).stream().map(this::toProgressDto).toList();
    }

    public List<JobProgressDto> getJobsByStage(JobStageEnum stage) {
        return jobsRepository.findPaginatedFiltered(null, stage, null, 0, 100).stream().map(this::toProgressDto).toList();
    }

    public List<JobProgressDto> getAllJobs() {
        return jobsRepository.findAll().stream().map(this::toProgressDto).toList();
    }

    public JobProgressDto getJobProgress(String jobId) {
        JobsEntity job = jobsRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + jobId));
        return toProgressDto(job);
    }

    @Transactional
    public JobProgressDto retryJob(String jobId) {
        JobsEntity job = jobsRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + jobId));

        JobStatusEnum oldStatus = job.getStatus();
        job.setStatus(JobStatusEnum.PENDING);
        job.setCurrentStage(JobStageEnum.QUEUED);
        job.setFailureReason(null);
        job.setFailedAt(null);
        job.setCompletedAt(null);
        job.setTranscodingStartedAt(null);
        job.setTranscodedAt(null);
        job.setRecommendationSavedAt(null);
        job.setSearchSavedAt(null);
        job.setTranscodingDurationMs(null);
        job.setRecommendationDurationMs(null);
        job.setSearchDurationMs(null);
        job.setFinalizeDurationMs(null);
        job.setTotalDurationMs(null);
        job.setTranscoded(false);
        job.setSavedInSearch(false);
        job.setSavedInRecommendation(false);
        job.setTranscodingAttempt(job.getTranscodingAttempt() != null ? job.getTranscodingAttempt() + 1 : 1);

        jobsRepository.save(job);
        paginationMetaDataService.transitionJob(oldStatus, JobStatusEnum.PENDING);
        audioProcessingQueue.queueAudioProcessing(new AudioProcessingQueueDto(job.getId()));
        log.info("Job [{}] re-queued for retry (transcodingAttempt {})", jobId, job.getTranscodingAttempt());
        return toProgressDto(job);
    }

    /**
     * Recovers a failed or stalled ingestion job by replacing corrupted media files (tempSongKey / tempVideoKey),
     * resetting all execution state, and re-enqueueing the job.
     */
    @Transactional
    public JobProgressDto recoverJobMedia(String jobId, RecoverJobMediaRequestDto data) {
        JobsEntity job = jobsRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + jobId));

        boolean hasAudio = data.tempSongKey() != null && !data.tempSongKey().isBlank();
        boolean hasVideo = data.tempVideoKey() != null && !data.tempVideoKey().isBlank();

        if (!hasAudio && !hasVideo) {
            throw new IllegalArgumentException("Either replacement tempSongKey or tempVideoKey must be provided");
        }

        if (hasAudio) {
            job.setTempSongKey(data.tempSongKey().trim());
        }

        if (hasVideo) {
            job.setTempVideoKey(data.tempVideoKey().trim());
        }

        if (data.clipStartMin() != null || data.clipStartSec() != null) {
            int min = data.clipStartMin() != null ? data.clipStartMin() : 0;
            int sec = data.clipStartSec() != null ? data.clipStartSec() : 0;
            job.setClipStartSec(min * 60 + sec);
        }

        if (data.clipEndMin() != null || data.clipEndSec() != null) {
            int min = data.clipEndMin() != null ? data.clipEndMin() : 0;
            int sec = data.clipEndSec() != null ? data.clipEndSec() : 0;
            job.setClipEndSec(min * 60 + sec);
        }

        JobStatusEnum oldStatus = job.getStatus();
        job.setStatus(JobStatusEnum.PENDING);
        job.setCurrentStage(JobStageEnum.QUEUED);
        job.setFailureReason(null);
        job.setFailedAt(null);
        job.setCompletedAt(null);
        job.setTranscodingStartedAt(null);
        job.setTranscodedAt(null);
        job.setRecommendationSavedAt(null);
        job.setSearchSavedAt(null);
        job.setTranscodingDurationMs(null);
        job.setRecommendationDurationMs(null);
        job.setSearchDurationMs(null);
        job.setFinalizeDurationMs(null);
        job.setTotalDurationMs(null);
        job.setTranscoded(false);
        job.setSavedInSearch(false);
        job.setSavedInRecommendation(false);
        job.setTranscodingAttempt(job.getTranscodingAttempt() != null ? job.getTranscodingAttempt() + 1 : 1);

        jobsRepository.save(job);
        paginationMetaDataService.transitionJob(oldStatus, JobStatusEnum.PENDING);
        audioProcessingQueue.queueAudioProcessing(new AudioProcessingQueueDto(job.getId()));
        log.info("Job [{}] recovered with new media (audio: {}, video: {}) and re-queued (transcodingAttempt {})",
                jobId, hasAudio, hasVideo, job.getTranscodingAttempt());
        return toProgressDto(job);
    }

    @Transactional
    public void deleteJob(String jobId) {
        JobsEntity job = jobsRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + jobId));

        String songId = job.getSongId();
        log.info("Initiating comprehensive garbage cleanup for Job [{}] (songId: {})", jobId, songId);

        // 0. Cancel any active or queued Inngest execution and de-queue from Redis
        try {
            // A. De-queue from Redis if still waiting in audio_processing_queue
            audioProcessingQueue.removeJobFromQueue(jobId);

            // B. Push cancellation event to Redis audio_cancel_queue
            audioProcessingQueue.cancelJob(jobId);

            // C. Fire HTTP cleanup & cancel request to audioProcessing worker Express endpoint
            try {
                java.net.http.HttpClient httpClient = java.net.http.HttpClient.newBuilder()
                        .connectTimeout(Duration.ofSeconds(2))
                        .build();

                Map<String, String> body = new HashMap<>();
                if (songId != null) body.put("songId", songId);
                if (job.getTempSongKey() != null) body.put("tempSongKey", job.getTempSongKey());
                if (job.getTempVideoKey() != null) body.put("tempVideoKey", job.getTempVideoKey());
                if (job.getSongKey() != null) body.put("songKey", job.getSongKey());
                if (job.getFullVideoKey() != null) body.put("fullVideoKey", job.getFullVideoKey());

                StringBuilder jsonBuilder = new StringBuilder("{");
                boolean first = true;
                for (Map.Entry<String, String> entry : body.entrySet()) {
                    if (!first) jsonBuilder.append(",");
                    jsonBuilder.append("\"").append(entry.getKey()).append("\":\"").append(entry.getValue()).append("\"");
                    first = false;
                }
                jsonBuilder.append("}");

                java.net.http.HttpRequest req = java.net.http.HttpRequest.newBuilder()
                        .uri(java.net.URI.create(audioProcessingUrl + "/api/jobs/" + jobId + "/cleanup"))
                        .header("Content-Type", "application/json")
                        .timeout(Duration.ofSeconds(2))
                        .POST(java.net.http.HttpRequest.BodyPublishers.ofString(jsonBuilder.toString()))
                        .build();

                httpClient.sendAsync(req, java.net.http.HttpResponse.BodyHandlers.discarding());
                log.info("Dispatched async HTTP cleanup & cancel request to audioProcessing for job [{}]", jobId);
            } catch (Exception e) {
                log.warn("Could not dispatch HTTP cleanup to audioProcessing: {}", e.getMessage());
            }

            // D. Fire event directly to Inngest Dev Server / Inngest Event API
            try {
                java.net.http.HttpClient inngestClient = java.net.http.HttpClient.newBuilder()
                        .connectTimeout(Duration.ofSeconds(2))
                        .build();

                String inngestPayload = String.format("[{\"name\":\"audio/job.cancel\",\"data\":{\"jobId\":\"%s\"}}]", jobId);
                java.net.http.HttpRequest inngestReq = java.net.http.HttpRequest.newBuilder()
                        .uri(java.net.URI.create(inngestDevUrl + "/e/dev"))
                        .header("Content-Type", "application/json")
                        .timeout(Duration.ofSeconds(2))
                        .POST(java.net.http.HttpRequest.BodyPublishers.ofString(inngestPayload))
                        .build();

                inngestClient.sendAsync(inngestReq, java.net.http.HttpResponse.BodyHandlers.discarding());
                log.info("Dispatched async cancellation event directly to Inngest Dev Server for job [{}]", jobId);
            } catch (Exception e) {
                log.warn("Could not dispatch cancellation event to Inngest dev server: {}", e.getMessage());
            }
        } catch (Exception e) {
            log.warn("Error during Inngest cancellation for job [{}]: {}", jobId, e.getMessage());
        }

        // 1. Clean Algolia Search Index
        if (songId != null && !songId.isBlank()) {
            try {
                algoliaSearch.delete(songId);
                log.info("Purged Algolia search index for songId [{}] (Job [{}])", songId, jobId);
            } catch (Exception e) {
                log.warn("Failed to purge Algolia search for songId {}: {}", songId, e.getMessage());
            }
        }

        // 2. Clean Recombee Recommendation Item Vectors
        if (songId != null && !songId.isBlank()) {
            try {
                recombee.delete(songId);
                log.info("Purged Recombee recommendation item for songId [{}] (Job [{}])", songId, jobId);
            } catch (Exception e) {
                log.warn("Failed to purge Recombee item for songId {}: {}", songId, e.getMessage());
            }
        }

        // 3. Clean Temporary Uploads & Staging Files from S3 (melody-temp)
        if (job.getTempSongKey() != null && !job.getTempSongKey().isBlank()) {
            try {
                s3.deleteObject(job.getTempSongKey(), tempBucket);
                s3.deletePrefix(job.getTempSongKey(), tempBucket);
                log.info("Purged tempSongKey [{}] from S3 temp bucket", job.getTempSongKey());
            } catch (Exception e) {
                log.warn("Failed to delete tempSongKey {}: {}", job.getTempSongKey(), e.getMessage());
            }
        }
        if (job.getTempVideoKey() != null && !job.getTempVideoKey().isBlank()) {
            try {
                s3.deleteObject(job.getTempVideoKey(), tempBucket);
                s3.deletePrefix(job.getTempVideoKey(), tempBucket);
                log.info("Purged tempVideoKey [{}] from S3 temp bucket", job.getTempVideoKey());
            } catch (Exception e) {
                log.warn("Failed to delete tempVideoKey {}: {}", job.getTempVideoKey(), e.getMessage());
            }
        }
        if (songId != null && !songId.isBlank()) {
            try {
                s3.deletePrefix(songId, tempBucket);
                s3.deletePrefix("audios/" + songId, tempBucket);
                s3.deletePrefix("videos/" + songId, tempBucket);
            } catch (Exception e) {
                log.warn("Failed to clean tempBucket prefixes for songId {}: {}", songId, e.getMessage());
            }
        }
        try {
            s3.deletePrefix(jobId, tempBucket);
        } catch (Exception e) {
            log.warn("Failed to clean tempBucket prefix for jobId {}: {}", jobId, e.getMessage());
        }

        // 4. Clean Transcoded Chunk Trees from Production S3 (melody-songs)
        if (job.getSongKey() != null && !job.getSongKey().isBlank()) {
            try {
                s3.deletePrefix(job.getSongKey(), productionBucket);
                log.info("Purged S3 audio prefix [{}] from production bucket", job.getSongKey());
            } catch (Exception e) {
                log.warn("Failed to delete S3 audio prefix {}: {}", job.getSongKey(), e.getMessage());
            }
        }
        if (job.getFullVideoKey() != null && !job.getFullVideoKey().isBlank()) {
            try {
                s3.deletePrefix(job.getFullVideoKey(), productionBucket);
                log.info("Purged S3 video prefix [{}] from production bucket", job.getFullVideoKey());
            } catch (Exception e) {
                log.warn("Failed to delete S3 fullVideoKey prefix {}: {}", job.getFullVideoKey(), e.getMessage());
            }
        }
        // In case the job failed mid-transcoding before songKey or fullVideoKey were saved to DB:
        // audioProcessing writes directly to audios/<songId> and videos/<songId>
        if (songId != null && !songId.isBlank()) {
            try {
                s3.deletePrefix("audios/" + songId, productionBucket);
                s3.deletePrefix("videos/" + songId, productionBucket);
                s3.deletePrefix(songId, productionBucket);
                log.info("Purged conventional S3 prefixes (audios/{}, videos/{}) from production bucket", songId, songId);
            } catch (Exception e) {
                log.warn("Failed to delete conventional S3 chunk prefixes for songId {}: {}", songId, e.getMessage());
            }
        }

        // 5. Clean ImageKit CDN Assets (Cover Artwork & Looping Canvas Video)
        if (job.getImageKey() != null && !job.getImageKey().isBlank()) {
            try {
                imageKit.deleteByKey(job.getImageKey());
                log.info("Purged ImageKit artwork key [{}]", job.getImageKey());
            } catch (Exception e) {
                log.warn("Failed to delete ImageKit imageKey {}: {}", job.getImageKey(), e.getMessage());
            }
        }
        if (job.getVideoKey() != null && !job.getVideoKey().isBlank()) {
            try {
                imageKit.deleteByKey(job.getVideoKey());
                log.info("Purged ImageKit canvas video key [{}]", job.getVideoKey());
            } catch (Exception e) {
                log.warn("Failed to delete ImageKit videoKey {}: {}", job.getVideoKey(), e.getMessage());
            }
        }

        // 6. Clean Associated Song Entity if half-created or orphaned in PostgreSQL
        if (songId != null && !songId.isBlank()) {
            try {
                songsRepository.findById(songId).ifPresent(song -> {
                    StatusEnum previousStatus = song.getStatus();
                    songsRepository.deleteById(songId);
                    if (previousStatus != null) {
                        paginationMetaDataService.decrementStatus("SongsEntity", previousStatus);
                    }
                    log.info("Deleted orphaned SongsEntity [{}] associated with Job [{}]", songId, jobId);
                });
            } catch (Exception e) {
                log.warn("Failed to delete associated SongsEntity for songId {}: {}", songId, e.getMessage());
            }
        }

        // 7. Decrement pagination metadata for JobsEntity
        try {
            paginationMetaDataService.decrementJob(job.getStatus());
        } catch (Exception e) {
            log.warn("Failed to decrement pagination metadata for job {}: {}", jobId, e.getMessage());
        }

        // 8. Delete the JobsEntity record
        jobsRepository.deleteById(jobId);
        log.info("Job [{}] and all associated cloud/DB resources purged successfully by admin", jobId);
    }

    /**
     * Purges all FAILED jobs and cleans up all their residual cloud, Inngest, and database artifacts.
     */
    @Transactional
    public int deleteAllFailedJobs() {
        List<JobsEntity> failedJobs = jobsRepository.findByStatus(JobStatusEnum.FAILED);
        log.info("Initiating bulk garbage cleanup for {} failed jobs", failedJobs.size());
        int count = 0;
        for (JobsEntity job : failedJobs) {
            try {
                deleteJob(job.getId());
                count++;
            } catch (Exception e) {
                log.error("Error purging failed job [{}]: {}", job.getId(), e.getMessage());
            }
        }
        return count;
    }

    public JobProgressDto toProgressDto(JobsEntity job) {
        LocalDateTime now = LocalDateTime.now();
        JobStageEnum currentStage = job.getCurrentStage() != null ? job.getCurrentStage() : JobStageEnum.QUEUED;
        JobStatusEnum status = job.getStatus() != null ? job.getStatus() : JobStatusEnum.PENDING;
        boolean isReprocess = Boolean.TRUE.equals(job.getIsVideoReprocess()) || Boolean.TRUE.equals(job.getIsAudioReprocess());

        // Calculate total elapsed time
        Long elapsedTotalMs = job.getTotalDurationMs();
        if (elapsedTotalMs == null && job.getCreatedAt() != null) {
            if (status == JobStatusEnum.COMPLETED) {
                LocalDateTime end = job.getCompletedAt() != null ? job.getCompletedAt()
                        : (job.getSearchSavedAt() != null ? job.getSearchSavedAt()
                        : (job.getTranscodedAt() != null ? job.getTranscodedAt() : job.getCreatedAt()));
                elapsedTotalMs = Duration.between(job.getCreatedAt(), end).toMillis();
            } else if (status == JobStatusEnum.FAILED) {
                LocalDateTime end = job.getFailedAt() != null ? job.getFailedAt()
                        : (job.getSearchSavedAt() != null ? job.getSearchSavedAt()
                        : (job.getTranscodedAt() != null ? job.getTranscodedAt() : job.getCreatedAt()));
                elapsedTotalMs = Duration.between(job.getCreatedAt(), end).toMillis();
            } else {
                // Active/Pending jobs calculate elapsed time up to now
                elapsedTotalMs = Duration.between(job.getCreatedAt(), now).toMillis();
            }
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
            LocalDateTime end = job.getFailedAt() != null ? job.getFailedAt() : job.getCreatedAt();
            if (job.getCreatedAt() != null) {
                qDuration = Duration.between(job.getCreatedAt(), end).toMillis();
            }
        } else if (status == JobStatusEnum.PENDING || status == JobStatusEnum.PROCESSING) {
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
                LocalDateTime end = (status == JobStatusEnum.FAILED && job.getFailedAt() != null) ? job.getFailedAt() : now;
                tDuration = Duration.between(job.getTranscodingStartedAt(), end).toMillis();
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
                LocalDateTime end = (status == JobStatusEnum.FAILED && job.getFailedAt() != null) ? job.getFailedAt() : now;
                rDuration = Duration.between(job.getTranscodedAt(), end).toMillis();
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
                LocalDateTime end = (status == JobStatusEnum.FAILED && job.getFailedAt() != null) ? job.getFailedAt() : now;
                sDuration = Duration.between(job.getRecommendationSavedAt(), end).toMillis();
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
                LocalDateTime end = (status == JobStatusEnum.FAILED && job.getFailedAt() != null) ? job.getFailedAt() : now;
                fDuration = Duration.between(prev, end).toMillis();
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
                .isVideoReprocess(Boolean.TRUE.equals(job.getIsVideoReprocess()))
                .isAudioReprocess(Boolean.TRUE.equals(job.getIsAudioReprocess()))
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

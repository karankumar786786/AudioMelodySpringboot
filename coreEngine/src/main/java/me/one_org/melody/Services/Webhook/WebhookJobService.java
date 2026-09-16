package me.one_org.melody.Services.Webhook;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.AlgoliaSearch.AlgoliaSearch;
import me.one_org.melody.BlobStorage.S3;
import me.one_org.melody.Dto.Webhook.JobFailedRequestDto;
import me.one_org.melody.Dto.Webhook.JobStartedRequestDto;
import me.one_org.melody.Dto.Webhook.TranscodedRequestDto;
import me.one_org.melody.Entity.JobsEntity;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Enums.JobStageEnum;
import me.one_org.melody.Enums.JobStatusEnum;
import me.one_org.melody.Recommendation.Recombee;
import me.one_org.melody.Repository.JobsRepository;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Services.General.PaginationMetaDataService;
import me.one_org.melody.Exceptions.ResourceNotFoundException;

import java.time.Duration;
import java.time.LocalDateTime;

@Service
@Slf4j
public class WebhookJobService {

    @Value("${s3.temp-bucket}")
    private String tempBucket;

    private final JobsRepository jobsRepository;
    private final SongsRepository songsRepository;
    private final AlgoliaSearch algoliaSearch;
    private final Recombee recombee;
    private final PaginationMetaDataService paginationMetaDataService;
    private final S3 s3;

    @Autowired(required = false)
    private CacheManager cacheManager;

    public WebhookJobService(JobsRepository jobsRepository, SongsRepository songsRepository,
            AlgoliaSearch algoliaSearch, Recombee recombee,
            PaginationMetaDataService paginationMetaDataService,S3 s3) {
        this.jobsRepository = jobsRepository;
        this.songsRepository = songsRepository;
        this.algoliaSearch = algoliaSearch;
        this.recombee = recombee;
        this.paginationMetaDataService = paginationMetaDataService;
        this.s3 = s3;
    }

    public JobsEntity getJob(String jobId) {
        return jobsRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found with id: " + jobId));
    }

    @Transactional
    public void transcodingStarted(String jobId, JobStartedRequestDto data) {
        JobsEntity job = getJob(jobId);
        JobStatusEnum oldStatus = job.getStatus();
        job.setTranscodingId(data.processingId());
        job.setTranscodingAttempt(job.getTranscodingAttempt() != null ? job.getTranscodingAttempt() + 1 : 1);
        job.setStatus(JobStatusEnum.PROCESSING);
        job.setCurrentStage(JobStageEnum.TRANSCODING);
        job.setTranscodingStartedAt(LocalDateTime.now());
        jobsRepository.save(job);
        paginationMetaDataService.transitionJob(oldStatus, JobStatusEnum.PROCESSING);
        log.info("Job {} transcoding started (attempt {}, stage {})", jobId, job.getTranscodingAttempt(), job.getCurrentStage());
    }

    @Transactional
    public void transcoded(String jobId, TranscodedRequestDto data) {
        JobsEntity job = getJob(jobId);
        job.setSongKey(data.songKey());
        if (data.duration() != null) {
            job.setDuration(data.duration());
        }
        if (data.fullVideoKey() != null && !data.fullVideoKey().isBlank()) {
            job.setFullVideoKey(data.fullVideoKey());
        }
        if (data.videoKey() != null && !data.videoKey().isBlank()) {
            job.setVideoKey(data.videoKey());
        }
        job.setTranscoded(true);
        LocalDateTime now = LocalDateTime.now();
        job.setTranscodedAt(now);
        if (job.getTranscodingStartedAt() != null) {
            job.setTranscodingDurationMs(Duration.between(job.getTranscodingStartedAt(), now).toMillis());
        }

        boolean isReprocess = Boolean.TRUE.equals(job.getIsVideoReprocess()) || Boolean.TRUE.equals(job.getIsAudioReprocess());
        if (isReprocess) {
            job.setCurrentStage(JobStageEnum.FINALIZING);
        } else {
            job.setCurrentStage(JobStageEnum.RECOMMENDATION_INDEXING);
        }

        if (job.getTempSongKey() != null && !job.getTempSongKey().isBlank()) {
            try {
                s3.deleteObject(job.getTempSongKey(), tempBucket);
            } catch (Exception e) {
                log.warn("Failed to delete tempSongKey {}: {}", job.getTempSongKey(), e.getMessage());
            }
        }
        if (job.getTempVideoKey() != null && !job.getTempVideoKey().isBlank()) {
            try {
                s3.deleteObject(job.getTempVideoKey(), tempBucket);
            } catch (Exception e) {
                log.warn("Failed to delete tempVideoKey {}: {}", job.getTempVideoKey(), e.getMessage());
            }
        }
        jobsRepository.save(job);
        log.info("Job {} transcoded successfully in {}ms, next stage: {}",
                jobId, job.getTranscodingDurationMs(), job.getCurrentStage());
    }

    @Transactional
    public void saveRecommendation(String jobId) {
        JobsEntity job = getJob(jobId);
        try {
            recombee.saveSong(job.getSongId(), job.getTitle(), job.getArtistName(),
                    job.getLanguage() != null ? job.getLanguage() : "unknown");
            job.setSavedInRecommendation(true);
            LocalDateTime now = LocalDateTime.now();
            job.setRecommendationSavedAt(now);
            if (job.getTranscodedAt() != null) {
                job.setRecommendationDurationMs(Duration.between(job.getTranscodedAt(), now).toMillis());
            }
            job.setCurrentStage(JobStageEnum.SEARCH_INDEXING);
            jobsRepository.save(job);
            log.info("Job {} indexed in Recombee in {}ms, next stage: {}",
                    jobId, job.getRecommendationDurationMs(), job.getCurrentStage());
        } catch (Exception e) {
            log.error("Failed to save job {} to Recombee: {}", jobId, e.getMessage(), e);
            throw new RuntimeException("Recombee indexing failed: " + e.getMessage(), e);
        }
    }

    @Transactional
    public void saveSearch(String jobId) {
        JobsEntity job = getJob(jobId);
        try {
            // Save search record to Algolia
            SongsEntity tempSong = SongsEntity.builder()
                    .id(job.getSongId())
                    .title(job.getTitle())
                    .artistName(job.getArtistName())
                    .duration(job.getDuration())
                    .songKey(job.getSongKey() != null ? job.getSongKey() : "")
                    .imageKey(job.getImageKey())
                    .videoKey(job.getVideoKey())
                    .fullVideoKey(job.getFullVideoKey())
                    .previewStartTime(job.getPreviewStartTime())
                    .previewEndTime(job.getPreviewEndTime())
                    .language(job.getLanguage() != null ? job.getLanguage() : "unknown")
                    .lrclibId(job.getLrclibId())
                    .jobId(job.getId())
                    .build();
            algoliaSearch.save(tempSong);
            job.setSavedInSearch(true);
            LocalDateTime now = LocalDateTime.now();
            job.setSearchSavedAt(now);
            if (job.getRecommendationSavedAt() != null) {
                job.setSearchDurationMs(Duration.between(job.getRecommendationSavedAt(), now).toMillis());
            }
            job.setCurrentStage(JobStageEnum.FINALIZING);
            jobsRepository.save(job);
            log.info("Job {} indexed in Algolia in {}ms, next stage: {}",
                    jobId, job.getSearchDurationMs(), job.getCurrentStage());
        } catch (Exception e) {
            log.error("Failed to save job {} to Algolia: {}", jobId, e.getMessage(), e);
            throw new RuntimeException("Algolia search indexing failed: " + e.getMessage(), e);
        }
    }

    @Transactional
    public void finalizeJob(String jobId) {
        JobsEntity job = getJob(jobId);
        String songId = job.getSongId();
        LocalDateTime now = LocalDateTime.now();
        job.setCompletedAt(now);

        if (job.getSearchSavedAt() != null) {
            job.setFinalizeDurationMs(Duration.between(job.getSearchSavedAt(), now).toMillis());
        } else if (job.getTranscodedAt() != null) {
            job.setFinalizeDurationMs(Duration.between(job.getTranscodedAt(), now).toMillis());
        }

        if (job.getCreatedAt() != null) {
            job.setTotalDurationMs(Duration.between(job.getCreatedAt(), now).toMillis());
        }

        boolean isReprocess = Boolean.TRUE.equals(job.getIsVideoReprocess()) || Boolean.TRUE.equals(job.getIsAudioReprocess());
        if (isReprocess) {
            // REPROCESS / RECOVERY: patch existing song without recreating it
            SongsEntity existingSong = songsRepository.findById(songId)
                    .orElseThrow(() -> new ResourceNotFoundException("Song not found with id: " + songId));
            if (job.getSongKey() != null && !job.getSongKey().isBlank()) {
                existingSong.setSongKey(job.getSongKey());
            }
            if (job.getDuration() != null && job.getDuration() > 0) {
                existingSong.setDuration(job.getDuration());
            }
            if (job.getFullVideoKey() != null && !job.getFullVideoKey().isBlank()) {
                existingSong.setFullVideoKey(job.getFullVideoKey());
            }
            if (job.getVideoKey() != null && !job.getVideoKey().isBlank()) {
                existingSong.setVideoKey(job.getVideoKey());
            }
            songsRepository.save(existingSong);

            if (Boolean.TRUE.equals(job.getIsAudioReprocess())) {
                try {
                    algoliaSearch.save(existingSong);
                } catch (Exception e) {
                    log.warn("Failed to update Algolia search for song {} after audio recovery: {}", songId, e.getMessage());
                }
            }

            evictSongCaches(songId);

            JobStatusEnum oldStatus = job.getStatus();
            job.setStatus(JobStatusEnum.COMPLETED);
            job.setCurrentStage(JobStageEnum.COMPLETED);
            jobsRepository.save(job);
            paginationMetaDataService.transitionJob(oldStatus, JobStatusEnum.COMPLETED);
            log.info("Reprocess/recovery job {} completed in {}ms — media updated on song {}",
                    jobId, job.getTotalDurationMs(), songId);
            return;
        }

        // STANDARD: Create permanent SongsEntity
        SongsEntity song = SongsEntity.builder()
                .id(songId)
                .title(job.getTitle())
                .artistName(job.getArtistName())
                .duration(job.getDuration())
                .songKey(job.getSongKey())
                .imageKey(job.getImageKey())
                .videoKey(job.getVideoKey())
                .fullVideoKey(job.getFullVideoKey())
                .previewStartTime(job.getPreviewStartTime())
                .previewEndTime(job.getPreviewEndTime())
                .language(job.getLanguage() != null ? job.getLanguage() : "unknown")
                .lrclibId(job.getLrclibId())
                .jobId(job.getId())
                .build();
        songsRepository.save(song);
        paginationMetaDataService.incrementStatus("SongsEntity", song.getStatus());

        JobStatusEnum oldStatus = job.getStatus();
        job.setStatus(JobStatusEnum.COMPLETED);
        job.setCurrentStage(JobStageEnum.COMPLETED);
        jobsRepository.save(job);
        paginationMetaDataService.transitionJob(oldStatus, JobStatusEnum.COMPLETED);
        log.info("Job {} finalized in total {}ms — song {} created successfully",
                job.getId(), job.getTotalDurationMs(), songId);
    }

    @Transactional
    public void failed(String jobId, JobFailedRequestDto data) {
        JobsEntity job = getJob(jobId);
        JobStatusEnum oldStatus = job.getStatus();
        LocalDateTime now = LocalDateTime.now();
        job.setStatus(JobStatusEnum.FAILED);
        job.setCurrentStage(JobStageEnum.FAILED);
        job.setFailedAt(now);
        job.setFailureReason(data.reason());
        if (job.getCreatedAt() != null) {
            job.setTotalDurationMs(Duration.between(job.getCreatedAt(), now).toMillis());
        }
        jobsRepository.save(job);
        paginationMetaDataService.transitionJob(oldStatus, JobStatusEnum.FAILED);
        log.error("Job {} failed after {}ms: {}", jobId, job.getTotalDurationMs(), data.reason());
    }

    private void evictSongCaches(String songId) {
        if (cacheManager != null) {
            try {
                Optional.ofNullable(cacheManager.getCache("songs")).ifPresent(c -> c.evict(songId));
                Optional.ofNullable(cacheManager.getCache("song_lists")).ifPresent(c -> c.clear());
                Optional.ofNullable(cacheManager.getCache("featured_songs")).ifPresent(c -> c.clear());
                log.info("Evicted caches for song {}", songId);
            } catch (Exception e) {
                log.warn("Failed to evict Redis caches for song {}: {}", songId, e.getMessage());
            }
        }
    }
}

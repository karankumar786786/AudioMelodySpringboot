package me.one_org.melody.Services.Webhook;


import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.AlgoliaSearch.AlgoliaSearch;
import me.one_org.melody.BlobStorage.S3;
import me.one_org.melody.Dto.Webhook.JobFailedRequestDto;
import me.one_org.melody.Dto.Webhook.JobStartedRequestDto;
import me.one_org.melody.Dto.Webhook.TranscodedRequestDto;
import me.one_org.melody.Entity.JobsEntity;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Enums.JobStatusEnum;
import me.one_org.melody.Recommendation.Recombee;
import me.one_org.melody.Repository.JobsRepository;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Services.General.PaginationMetaDataService;
import me.one_org.melody.Exceptions.ResourceNotFoundException;

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
        job.setTranscodingId(data.processingId());
        job.setTranscodingAttempt(job.getTranscodingAttempt() != null ? job.getTranscodingAttempt() + 1 : 1);
        job.setStatus(JobStatusEnum.PROCESSING);
        jobsRepository.save(job);
        log.info("Job {} transcoding started (attempt {})", jobId, job.getTranscodingAttempt());
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
        log.info("Job {} transcoded successfully, songKey: {}, fullVideoKey: {}, duration: {}",
                jobId, data.songKey(), data.fullVideoKey(), data.duration());
    }

    @Transactional
    public void saveRecommendation(String jobId) {
        JobsEntity job = getJob(jobId);
        try {
            recombee.saveSong(job.getSongId(), job.getTitle(), job.getArtistName(),
                    job.getLanguage() != null ? job.getLanguage() : "unknown");
            job.setSavedInRecommendation(true);
            jobsRepository.save(job);
            log.info("Job {} indexed in Recombee successfully", jobId);
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
                    .language(job.getLanguage() != null ? job.getLanguage() : "unknown")
                    .lrclibId(job.getLrclibId())
                    .jobId(job.getId())
                    .build();
            algoliaSearch.save(tempSong);
            job.setSavedInSearch(true);
            jobsRepository.save(job);
            log.info("Job {} indexed in Algolia successfully", jobId);
        } catch (Exception e) {
            log.error("Failed to save job {} to Algolia: {}", jobId, e.getMessage(), e);
            throw new RuntimeException("Algolia search indexing failed: " + e.getMessage(), e);
        }
    }

    @Transactional
    public void finalizeJob(String jobId) {
        JobsEntity job = getJob(jobId);
        String songId = job.getSongId();

        if (Boolean.TRUE.equals(job.getIsVideoReprocess())) {
            // VIDEO REPROCESS: only patch fullVideoKey (and canvas videoKey) on the existing song
            SongsEntity existingSong = songsRepository.findById(songId)
                    .orElseThrow(() -> new ResourceNotFoundException("Song not found with id: " + songId));
            if (job.getFullVideoKey() != null && !job.getFullVideoKey().isBlank()) {
                existingSong.setFullVideoKey(job.getFullVideoKey());
            }
            if (job.getVideoKey() != null && !job.getVideoKey().isBlank()) {
                existingSong.setVideoKey(job.getVideoKey());
            }
            songsRepository.save(existingSong);
            job.setStatus(JobStatusEnum.COMPLETED);
            jobsRepository.save(job);
            log.info("Video reprocess job {} completed — fullVideoKey updated on song {}", jobId, songId);
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
                .language(job.getLanguage() != null ? job.getLanguage() : "unknown")
                .lrclibId(job.getLrclibId())
                .jobId(job.getId())
                .build();
        songsRepository.save(song);
        paginationMetaDataService.incrementStatus("SongsEntity", song.getStatus());

        job.setStatus(JobStatusEnum.COMPLETED);
        jobsRepository.save(job);
        log.info("Job {} finalized — song {} created successfully", job.getId(), songId);
    }

    @Transactional
    public void failed(String jobId, JobFailedRequestDto data) {
        JobsEntity job = getJob(jobId);
        job.setStatus(JobStatusEnum.FAILED);
        jobsRepository.save(job);
        log.error("Job {} failed: {}", jobId, data.reason());
    }
}

package me.one_org.melody.Webhook;

import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.AlgoliaSearch.AlgoliaSearch;
import me.one_org.melody.Dto.Webhook.JobFailedRequestDto;
import me.one_org.melody.Dto.Webhook.JobStartedRequestDto;
import me.one_org.melody.Dto.Webhook.TranscodedRequestDto;
import me.one_org.melody.Dto.Webhook.TranscribedRequestDto;
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
public class WebhookService {

    private final JobsRepository jobsRepository;
    private final SongsRepository songsRepository;
    private final AlgoliaSearch algoliaSearch;
    private final Recombee recombee;
    private final PaginationMetaDataService paginationMetaDataService;

    public WebhookService(JobsRepository jobsRepository, SongsRepository songsRepository,
                          AlgoliaSearch algoliaSearch, Recombee recombee,
                          PaginationMetaDataService paginationMetaDataService) {
        this.jobsRepository = jobsRepository;
        this.songsRepository = songsRepository;
        this.algoliaSearch = algoliaSearch;
        this.recombee = recombee;
        this.paginationMetaDataService = paginationMetaDataService;
    }

    private JobsEntity getJob(String jobId) {
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
        job.setTranscoded(true);
        jobsRepository.save(job);
        log.info("Job {} transcoded successfully, songKey: {}", jobId, data.songKey());

        // Check if both steps are done
        checkAndFinalize(job);
    }

    @Transactional
    public void transcribingStarted(String jobId, JobStartedRequestDto data) {
        JobsEntity job = getJob(jobId);
        job.setTranscribingId(data.processingId());
        job.setTranscribingAttempt(job.getTranscribingAttempt() != null ? job.getTranscribingAttempt() + 1 : 1);
        job.setStatus(JobStatusEnum.PROCESSING);
        jobsRepository.save(job);
        log.info("Job {} transcribing started (attempt {})", jobId, job.getTranscribingAttempt());
    }

    @Transactional
    public void transcribed(String jobId, TranscribedRequestDto data) {
        JobsEntity job = getJob(jobId);
        job.setLanguage(data.language());
        job.setTranscribed(true);
        jobsRepository.save(job);
        log.info("Job {} transcribed successfully, language: {}", jobId, data.language());

        // Check if both steps are done
        checkAndFinalize(job);
    }

    @Transactional
    public void failed(String jobId, JobFailedRequestDto data) {
        JobsEntity job = getJob(jobId);
        job.setStatus(JobStatusEnum.FAILED);
        jobsRepository.save(job);
        log.error("Job {} failed: {}", jobId, data.reason());
    }

    /**
     * When both transcoded and transcribed are true:
     * 1. Save to Algolia
     * 2. Save to Recombee
     * 3. Create SongsEntity in DB
     * 4. Mark job as COMPLETED
     */
    private void checkAndFinalize(JobsEntity job) {
        if (!Boolean.TRUE.equals(job.getTranscoded()) || !Boolean.TRUE.equals(job.getTranscribed())) {
            return; // Not ready yet
        }

        String songId = UUID.randomUUID().toString();

        // Create SongsEntity
        SongsEntity song = SongsEntity.builder()
                .id(songId)
                .title(job.getTitle())
                .artistName(job.getArtistName())
                .duration(job.getDuration())
                .songKey(job.getSongKey())
                .imageKey(job.getImageKey())
                .language(job.getLanguage())
                .job(job)
                .build();
        songsRepository.save(song);
        paginationMetaDataService.incrementStatus("SongsEntity", song.getStatus());

        // Save to Algolia
        try {
            algoliaSearch.save(song);
            job.setSavedInSearch(true);
        } catch (Exception e) {
            log.error("Failed to save song {} to Algolia: {}", songId, e.getMessage());
        }

        // Save to Recombee
        try {
            recombee.saveSong(song);
            job.setSavedInRecommendation(true);
        } catch (Exception e) {
            log.error("Failed to save song {} to Recombee: {}", songId, e.getMessage());
        }

        job.setStatus(JobStatusEnum.COMPLETED);
        jobsRepository.save(job);
        log.info("Job {} finalized — song {} created and synced to Algolia/Recombee", job.getId(), songId);
    }
}

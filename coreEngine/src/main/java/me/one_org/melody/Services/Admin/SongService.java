package me.one_org.melody.Services.Admin;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import me.one_org.melody.AlgoliaSearch.AlgoliaSearch;
import me.one_org.melody.BlobStrorage.s3;
import me.one_org.melody.Dto.Controllers.Admin.CreateSongRequestDto;
import me.one_org.melody.Dto.Controllers.Admin.CreateSongResponseDto;
import me.one_org.melody.Dto.Queue.AudioProcessingQueueDto;
import me.one_org.melody.Entity.JobsEntity;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Enums.JobStatusEnum;
import me.one_org.melody.Queue.AudioProcessingQueue;
import me.one_org.melody.Recommendation.Recombee;
import me.one_org.melody.Repository.JobsRepository;
import me.one_org.melody.Repository.SongsRepository;

@Service
public class SongService {

    private final JobsRepository jobsRepository;
    private final SongsRepository songsRepository;
    private final AudioProcessingQueue audioProcessingQueue;
    private final AlgoliaSearch algoliaSearch;
    private final Recombee recombee;
    private final s3 s3Client;

    @Value("${s3.temp-bucket}")
    private String tempBucket;

    public SongService(JobsRepository jobsRepository, SongsRepository songsRepository,
                       AudioProcessingQueue audioProcessingQueue, AlgoliaSearch algoliaSearch,
                       Recombee recombee, s3 s3Client) {
        this.jobsRepository = jobsRepository;
        this.songsRepository = songsRepository;
        this.audioProcessingQueue = audioProcessingQueue;
        this.algoliaSearch = algoliaSearch;
        this.recombee = recombee;
        this.s3Client = s3Client;
    }

    @Transactional
    public CreateSongResponseDto createSong(CreateSongRequestDto data) {
        String jobId = UUID.randomUUID().toString();
        JobsEntity job = JobsEntity.builder()
                .id(jobId)
                .title(data.title())
                .artistName(data.artistName())
                .duration(data.duration())
                .tempSongKey(data.tempSongKey())
                .imageKey(data.imageKey())
                .language(data.language())
                .transcodingAttempt(0)
                .transcribingAttempt(0)
                .transcoded(false)
                .transcribed(false)
                .savedInSearch(false)
                .savedInRecommendation(false)
                .status(JobStatusEnum.PENDING)
                .build();
        jobsRepository.save(job);

        // Push to audio processing queue
        audioProcessingQueue.queueAudioProcessing(
                new AudioProcessingQueueDto(jobId, data.tempSongKey()));

        return new CreateSongResponseDto(jobId, JobStatusEnum.PENDING.name());
    }

    public List<SongsEntity> getAllSongs() {
        return songsRepository.findAll();
    }

    public SongsEntity getSongById(String id) {
        return songsRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Song not found"));
    }

    @Transactional
    public void deleteSong(String id) {
        SongsEntity song = songsRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Song not found"));

        // Remove from Algolia
        try {
            algoliaSearch.delete(id);
        } catch (Exception e) {
            // Log but don't fail
        }

        // Remove from Recombee
        try {
            recombee.delete(id);
        } catch (Exception e) {
            // Log but don't fail
        }

        songsRepository.deleteById(id);
    }

    public JobsEntity getJobById(String id) {
        return jobsRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Job not found"));
    }

    public List<JobsEntity> getAllJobs() {
        return jobsRepository.findAll();
    }

    public String getUploadUrl(String fileName) {
        String key = "uploads/" + UUID.randomUUID() + "/" + fileName;
        return s3Client.preSignedUrl(key, tempBucket, Duration.ofMinutes(30));
    }
}

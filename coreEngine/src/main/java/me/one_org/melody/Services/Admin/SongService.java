package me.one_org.melody.Services.Admin;


import java.util.List;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.AlgoliaSearch.AlgoliaSearch;
import me.one_org.melody.BlobStrorage.S3;
import me.one_org.melody.Dto.Controllers.Admin.CreateSongRequestDto;
import me.one_org.melody.Dto.Controllers.Admin.CreateSongResponseDto;
import me.one_org.melody.Dto.Queue.AudioProcessingQueueDto;
import me.one_org.melody.Entity.JobsEntity;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Enums.JobStatusEnum;
import me.one_org.melody.ImageStorage.ImageKit;
import me.one_org.melody.Queue.AudioProcessingQueue;
import me.one_org.melody.Recommendation.Recombee;
import me.one_org.melody.Repository.JobsRepository;
import me.one_org.melody.Repository.SongsRepository;

@Service
@Slf4j
public class SongService {

    private final JobsRepository jobsRepository;
    private final SongsRepository songsRepository;
    private final AudioProcessingQueue audioProcessingQueue;
    private final AlgoliaSearch algoliaSearch;
    private final Recombee recombee;
    private final S3 s3Client;
    private final ImageKit imageKit;

    @Value("${s3.temp-bucket}")
    private String tempBucket;
    @Value("${s3.temp-url-validity-min}")
    private int tempUrlValidityMin;
    @Value("${s3.song-bucket}")
    private String productionBucket;

    public SongService(JobsRepository jobsRepository, SongsRepository songsRepository,
                       AudioProcessingQueue audioProcessingQueue, AlgoliaSearch algoliaSearch,
                       Recombee recombee, S3 s3Client,ImageKit imageKit) {
        this.jobsRepository = jobsRepository;
        this.songsRepository = songsRepository;
        this.audioProcessingQueue = audioProcessingQueue;
        this.algoliaSearch = algoliaSearch;
        this.recombee = recombee;
        this.s3Client = s3Client;
        this.imageKit = imageKit;
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
        try {
            algoliaSearch.delete(id);
        } catch (Exception e) {
            log.debug(e.getStackTrace().toString());
            log.error(e.getMessage());
        }
        try {
            recombee.delete(id);
        } catch (Exception e) {
            log.debug(e.getStackTrace().toString());
            log.error(e.getMessage());
        }
        try {
            s3Client.deleteObject(song.getSongKey(),productionBucket);
        } catch (Exception e) {
        }
        imageKit.deleteByKey(song.getImageKey());
        songsRepository.deleteById(id);
    }

    public JobsEntity getJobById(String id) {
        return jobsRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Job not found"));
    }

    public List<JobsEntity> getAllJobs() {
        return jobsRepository.findAll();
    }

}

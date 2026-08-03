package me.one_org.melody.Services.General;

import java.util.List;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.AlgoliaSearch.AlgoliaSearch;
import me.one_org.melody.BlobStorage.S3;
import me.one_org.melody.Dto.Controllers.Admin.CreateSongRequestDto;
import me.one_org.melody.Dto.Controllers.Admin.CreateSongResponseDto;
import me.one_org.melody.Dto.Queue.AudioProcessingQueueDto;
import me.one_org.melody.Entity.JobsEntity;
import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Enums.JobStatusEnum;
import me.one_org.melody.Enums.StatusEnum;
import me.one_org.melody.Exceptions.ResourceNotFoundException;
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
    private final PaginationMetaDataService paginationMetaDataService;

    @Value("${s3.temp-bucket}")
    private String tempBucket;
    @Value("${s3.temp-url-validity-min}")
    private int tempUrlValidityMin;
    @Value("${s3.song-bucket}")
    private String productionBucket;

    public SongService(JobsRepository jobsRepository, SongsRepository songsRepository,
                       AudioProcessingQueue audioProcessingQueue, AlgoliaSearch algoliaSearch,
                       Recombee recombee, S3 s3Client, ImageKit imageKit,
                       PaginationMetaDataService paginationMetaDataService) {
        this.jobsRepository = jobsRepository;
        this.songsRepository = songsRepository;
        this.audioProcessingQueue = audioProcessingQueue;
        this.algoliaSearch = algoliaSearch;
        this.recombee = recombee;
        this.s3Client = s3Client;
        this.imageKit = imageKit;
        this.paginationMetaDataService = paginationMetaDataService;
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
                .lrclibId(data.lrclibId())
                .transcodingAttempt(0)
                .transcoded(false)
                .savedInSearch(false)
                .savedInRecommendation(false)
                .status(JobStatusEnum.PENDING)
                .build();
        jobsRepository.save(job);
        paginationMetaDataService.incrementStatus("JobsEntity", StatusEnum.ACTIVE);

        // Push to audio processing queue
        audioProcessingQueue.queueAudioProcessing(
                new AudioProcessingQueueDto(jobId, data.tempSongKey()));

        return new CreateSongResponseDto(jobId, JobStatusEnum.PENDING.name());
    }

    @Cacheable(value = "song_lists", key = "'all'")
    public List<SongsEntity> getAllSongs() {
        return songsRepository.findAll();
    }

    @Cacheable(value = "songs", key = "#id")
    public SongsEntity getSongById(String id) {
        return songsRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Song not found with id: " + id));
    }

    @Transactional
    @Caching(evict = {
        @CacheEvict(value = "songs", key = "#id"),
        @CacheEvict(value = "song_lists", allEntries = true)
    })
    public void deleteSong(String id) {
        SongsEntity song = songsRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Song not found with id: " + id));
        try {
            algoliaSearch.delete(id);
        } catch (Exception e) {
            log.error("Failed to delete song from Algolia", e);
        }
        try {
            recombee.delete(id);
        } catch (Exception e) {
            log.error("Failed to delete song from Recombee", e);
        }
        try {
            s3Client.deleteObject(song.getSongKey(), productionBucket);
        } catch (Exception e) {
            log.error("Failed to delete song object from S3", e);
        }
        imageKit.deleteByKey(song.getImageKey());
        songsRepository.deleteById(id);
        paginationMetaDataService.decrementStatus("SongsEntity", song.getStatus());
    }

    public JobsEntity getJobById(String id) {
        return jobsRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found with id: " + id));
    }

    public List<SongsEntity> getSongsPaginated(int page, int size) {
        return songsRepository.findAllPaginated(page, size);
    }

    public List<JobsEntity> getJobsPaginated(int page, int size) {
        return jobsRepository.findAllPaginated(page, size);
    }

    public PaginationMetaDataEntity getSongsPaginationMetaData() {
        return paginationMetaDataService.getMetaData("SongsEntity");
    }

    public PaginationMetaDataEntity getJobsPaginationMetaData() {
        return paginationMetaDataService.getMetaData("JobsEntity");
    }

    public List<JobsEntity> getAllJobs() {
        return jobsRepository.findAll();
    }
}

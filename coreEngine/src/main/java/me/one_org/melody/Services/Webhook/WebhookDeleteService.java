package me.one_org.melody.Services.Webhook;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.AlgoliaSearch.AlgoliaSearch;
import me.one_org.melody.Entity.ArtistsEntity;
import me.one_org.melody.Entity.DeleteJobsEntity;
import me.one_org.melody.Entity.PlaylistsEntity;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Enums.DeleteEntityType;
import me.one_org.melody.Enums.DeleteJobStageEnum;
import me.one_org.melody.Enums.DeleteJobStatusEnum;
import me.one_org.melody.Enums.StatusEnum;
import me.one_org.melody.Exceptions.ResourceNotFoundException;
import me.one_org.melody.ImageStorage.ImageKit;
import me.one_org.melody.Recommendation.Recombee;
import me.one_org.melody.Repository.ArtistsRepository;
import me.one_org.melody.Repository.DeleteJobsRepository;
import me.one_org.melody.Repository.PlaylistsRepository;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Services.General.PaginationMetaDataService;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;

@Service
@Slf4j
public class WebhookDeleteService {

    private final SongsRepository songsRepository;
    private final PlaylistsRepository playlistsRepository;
    private final ArtistsRepository artistsRepository;
    private final DeleteJobsRepository deleteJobsRepository;
    private final AlgoliaSearch algoliaSearch;
    private final Recombee recombee;
    private final ImageKit imageKit;
    private final PaginationMetaDataService paginationMetaDataService;

    public WebhookDeleteService(
            SongsRepository songsRepository,
            PlaylistsRepository playlistsRepository,
            ArtistsRepository artistsRepository,
            DeleteJobsRepository deleteJobsRepository,
            AlgoliaSearch algoliaSearch,
            Recombee recombee,
            ImageKit imageKit,
            PaginationMetaDataService paginationMetaDataService) {
        this.songsRepository = songsRepository;
        this.playlistsRepository = playlistsRepository;
        this.artistsRepository = artistsRepository;
        this.deleteJobsRepository = deleteJobsRepository;
        this.algoliaSearch = algoliaSearch;
        this.recombee = recombee;
        this.imageKit = imageKit;
        this.paginationMetaDataService = paginationMetaDataService;
    }

    private Optional<DeleteJobsEntity> findDeleteJob(String entityType, String entityId, String deleteJobId) {
        if (deleteJobId != null && !deleteJobId.isBlank()) {
            return deleteJobsRepository.findById(deleteJobId);
        }
        try {
            DeleteEntityType type = parseEntityType(entityType);
            return deleteJobsRepository.findLatestByEntity(type, entityId);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    public void deleteSearch(String entityType, String entityId, String deleteJobId) {
        parseEntityType(entityType);
        LocalDateTime now = LocalDateTime.now();
        Optional<DeleteJobsEntity> jobOpt = findDeleteJob(entityType, entityId, deleteJobId);
        jobOpt.ifPresent(job -> {
            if (job.getStatus() == DeleteJobStatusEnum.PENDING) {
                job.setStatus(DeleteJobStatusEnum.IN_PROGRESS);
            }
            if (job.getStartedAt() == null) {
                job.setStartedAt(now);
            }
            job.setCurrentStage(DeleteJobStageEnum.SEARCH_DELETED);
            job.setSearchDeletedAt(now);
            if (job.getCreatedAt() != null) {
                job.setSearchDurationMs(Duration.between(job.getCreatedAt(), now).toMillis());
            }
            deleteJobsRepository.save(job);
            log.info("DeleteJob [{}] transitioned to SEARCH_DELETED", job.getId());
        });

        try {
            algoliaSearch.delete(entityId);
        } catch (Exception ignored) {
        }
    }

    public void deleteRecommendation(String entityType, String entityId, String deleteJobId) {
        DeleteEntityType type = parseEntityType(entityType);
        LocalDateTime now = LocalDateTime.now();
        Optional<DeleteJobsEntity> jobOpt = findDeleteJob(entityType, entityId, deleteJobId);
        jobOpt.ifPresent(job -> {
            job.setCurrentStage(DeleteJobStageEnum.RECOMMENDATION_DELETED);
            job.setRecommendationDeletedAt(now);
            LocalDateTime prev = job.getSearchDeletedAt() != null ? job.getSearchDeletedAt() : job.getCreatedAt();
            if (prev != null) {
                job.setRecommendationDurationMs(Duration.between(prev, now).toMillis());
            }
            deleteJobsRepository.save(job);
            log.info("DeleteJob [{}] transitioned to RECOMMENDATION_DELETED", job.getId());
        });

        if (type != DeleteEntityType.SONG) {
            return;
        }
        try {
            recombee.delete(entityId);
        } catch (Exception ignored) {
        }
    }

    public void deleteImageKit(String entityType, String entityId, String deleteJobId) {
        DeleteEntityType type = parseEntityType(entityType);
        LocalDateTime now = LocalDateTime.now();
        Optional<DeleteJobsEntity> jobOpt = findDeleteJob(entityType, entityId, deleteJobId);
        jobOpt.ifPresent(job -> {
            job.setCurrentStage(DeleteJobStageEnum.IMAGEKIT_DELETED);
            job.setImagekitDeletedAt(now);
            LocalDateTime prev = job.getRecommendationDeletedAt() != null ? job.getRecommendationDeletedAt()
                    : (job.getSearchDeletedAt() != null ? job.getSearchDeletedAt() : job.getCreatedAt());
            if (prev != null) {
                job.setImagekitDurationMs(Duration.between(prev, now).toMillis());
            }
            deleteJobsRepository.save(job);
            log.info("DeleteJob [{}] transitioned to IMAGEKIT_DELETED", job.getId());
        });

        switch (type) {
            case SONG -> deleteSongImage(entityId);
            case PLAYLIST -> deletePlaylistImages(entityId);
            case ARTIST -> deleteArtistImages(entityId);
        }
    }

    public void deleteS3(String entityType, String entityId, String deleteJobId) {
        LocalDateTime now = LocalDateTime.now();
        Optional<DeleteJobsEntity> jobOpt = findDeleteJob(entityType, entityId, deleteJobId);
        jobOpt.ifPresent(job -> {
            job.setCurrentStage(DeleteJobStageEnum.S3_DELETED);
            job.setS3DeletedAt(now);
            LocalDateTime prev = job.getImagekitDeletedAt() != null ? job.getImagekitDeletedAt() : job.getCreatedAt();
            if (prev != null) {
                job.setS3DurationMs(Duration.between(prev, now).toMillis());
            }
            deleteJobsRepository.save(job);
            log.info("DeleteJob [{}] transitioned to S3_DELETED", job.getId());
        });
    }

    @Transactional
    public void hardDelete(String entityType, String entityId, String deleteJobId) {
        DeleteEntityType type = parseEntityType(entityType);
        LocalDateTime now = LocalDateTime.now();
        Optional<DeleteJobsEntity> jobOpt = findDeleteJob(entityType, entityId, deleteJobId);

        switch (type) {
            case SONG -> hardDeleteSong(entityId);
            case PLAYLIST -> hardDeletePlaylist(entityId);
            case ARTIST -> hardDeleteArtist(entityId);
        }

        jobOpt.ifPresent(job -> {
            job.setStatus(DeleteJobStatusEnum.COMPLETED);
            job.setCurrentStage(DeleteJobStageEnum.COMPLETED);
            job.setCompletedAt(now);
            LocalDateTime prev = job.getS3DeletedAt() != null ? job.getS3DeletedAt()
                    : (job.getImagekitDeletedAt() != null ? job.getImagekitDeletedAt() : job.getCreatedAt());
            if (prev != null) {
                job.setFinalizeDurationMs(Duration.between(prev, now).toMillis());
            }
            if (job.getCreatedAt() != null) {
                job.setTotalDurationMs(Duration.between(job.getCreatedAt(), now).toMillis());
            }
            deleteJobsRepository.save(job);
            log.info("DeleteJob [{}] completed successfully in {}ms", job.getId(), job.getTotalDurationMs());
        });
    }

    @Transactional
    public void failed(String entityType, String entityId, String deleteJobId, String reason) {
        LocalDateTime now = LocalDateTime.now();
        Optional<DeleteJobsEntity> jobOpt = findDeleteJob(entityType, entityId, deleteJobId);
        jobOpt.ifPresent(job -> {
            job.setStatus(DeleteJobStatusEnum.FAILED);
            job.setCurrentStage(DeleteJobStageEnum.FAILED);
            job.setFailedAt(now);
            job.setFailureReason(reason);
            if (job.getCreatedAt() != null) {
                job.setTotalDurationMs(Duration.between(job.getCreatedAt(), now).toMillis());
            }
            deleteJobsRepository.save(job);
            log.error("DeleteJob [{}] failed after {}ms: {}", job.getId(), job.getTotalDurationMs(), reason);
        });
    }

    private DeleteEntityType parseEntityType(String entityType) {
        try {
            return DeleteEntityType.valueOf(entityType.trim().toUpperCase());
        } catch (Exception e) {
            throw new ResourceNotFoundException("Unsupported delete entity type: " + entityType);
        }
    }

    private void deleteSongImage(String entityId) {
        SongsEntity song = songsRepository.findById(entityId).orElse(null);
        if (song == null) return;
        if (song.getImageKey() != null && !song.getImageKey().isBlank()) {
            imageKit.deleteByKey(song.getImageKey());
        }
        if (song.getVideoKey() != null && !song.getVideoKey().isBlank()) {
            imageKit.deleteByKey(song.getVideoKey());
        }
    }

    private void deletePlaylistImages(String entityId) {
        PlaylistsEntity playlist = playlistsRepository.findById(entityId).orElse(null);
        if (playlist == null) return;
        if (playlist.getCoverImageKey() != null && !playlist.getCoverImageKey().isBlank()) {
            imageKit.deleteByKey(playlist.getCoverImageKey());
        }
        if (playlist.getVideoKey() != null && !playlist.getVideoKey().isBlank()) {
            imageKit.deleteByKey(playlist.getVideoKey());
        }
    }

    private void deleteArtistImages(String entityId) {
        ArtistsEntity artist = artistsRepository.findById(entityId).orElse(null);
        if (artist == null) return;
        if (artist.getCoverImageKey() != null && !artist.getCoverImageKey().isBlank()) {
            imageKit.deleteByKey(artist.getCoverImageKey());
        }
    }

    private void hardDeleteSong(String entityId) {
        SongsEntity song = songsRepository.findById(entityId).orElse(null);
        if (song != null) {
            songsRepository.deleteById(entityId);
            paginationMetaDataService.decrementStatus(DeleteEntityType.SONG.metadataEntityName(),
                    song.getStatus() == null ? StatusEnum.ACTIVE : song.getStatus());
        }
    }

    private void hardDeletePlaylist(String entityId) {
        PlaylistsEntity playlist = playlistsRepository.findById(entityId).orElse(null);
        if (playlist != null) {
            playlistsRepository.deleteById(entityId);
            paginationMetaDataService.decrementStatus(DeleteEntityType.PLAYLIST.metadataEntityName(),
                    playlist.getStatus() == null ? StatusEnum.ACTIVE : playlist.getStatus());
        }
    }

    private void hardDeleteArtist(String entityId) {
        ArtistsEntity artist = artistsRepository.findById(entityId).orElse(null);
        if (artist != null) {
            artistsRepository.deleteById(entityId);
            paginationMetaDataService.decrementStatus(DeleteEntityType.ARTIST.metadataEntityName(),
                    artist.getStatus() == null ? StatusEnum.ACTIVE : artist.getStatus());
        }
    }
}
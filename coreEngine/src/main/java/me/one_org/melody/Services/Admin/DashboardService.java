package me.one_org.melody.Services.Admin;

import java.util.List;
import org.springframework.stereotype.Service;

import me.one_org.melody.Dto.Controllers.Admin.DashboardStatsDto;
import me.one_org.melody.Entity.JobsEntity;
import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Enums.JobStatusEnum;
import me.one_org.melody.Repository.JobsRepository;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Services.General.PaginationMetaDataService;

@Service
public class DashboardService {

    private final PaginationMetaDataService paginationMetaDataService;
    private final SongsRepository songsRepository;
    private final JobsRepository jobsRepository;

    public DashboardService(PaginationMetaDataService paginationMetaDataService,
                            SongsRepository songsRepository,
                            JobsRepository jobsRepository) {
        this.paginationMetaDataService = paginationMetaDataService;
        this.songsRepository = songsRepository;
        this.jobsRepository = jobsRepository;
    }

    public DashboardStatsDto getDashboardStats() {
        PaginationMetaDataEntity songsMeta = paginationMetaDataService.getMetaData("SongsEntity");
        PaginationMetaDataEntity artistsMeta = paginationMetaDataService.getMetaData("ArtistsEntity");
        PaginationMetaDataEntity playlistsMeta = paginationMetaDataService.getMetaData("PlaylistsEntity");
        PaginationMetaDataEntity usersMeta = paginationMetaDataService.getMetaData("UsersEntity");

        long featuredSongs = 0;
        try {
            featuredSongs = songsRepository.countFeatured();
        } catch (Exception ignored) {
        }

        long totalJobs = 0;
        long pendingJobs = 0;
        long failedJobs = 0;
        long processingJobs = 0;
        long completedJobs = 0;
        try {
            totalJobs = jobsRepository.count();
            pendingJobs = jobsRepository.countByStatus(JobStatusEnum.PENDING);
            failedJobs = jobsRepository.countByStatus(JobStatusEnum.FAILED);
            processingJobs = jobsRepository.countByStatus(JobStatusEnum.PROCESSING);
            completedJobs = jobsRepository.countByStatus(JobStatusEnum.COMPLETED);
        } catch (Exception ignored) {
        }

        List<SongsEntity> recentSongs = List.of();
        try {
            recentSongs = songsRepository.findAllPaginated(0, 5);
        } catch (Exception ignored) {
        }

        List<JobsEntity> recentJobs = List.of();
        try {
            recentJobs = jobsRepository.findRecent(5);
        } catch (Exception ignored) {
        }

        return new DashboardStatsDto(
            songsMeta != null ? songsMeta.getTotalCount() : 0L,
            songsMeta != null ? songsMeta.getActiveCount() : 0L,
            featuredSongs,
            artistsMeta != null ? artistsMeta.getTotalCount() : 0L,
            artistsMeta != null ? artistsMeta.getActiveCount() : 0L,
            playlistsMeta != null ? playlistsMeta.getTotalCount() : 0L,
            playlistsMeta != null ? playlistsMeta.getActiveCount() : 0L,
            usersMeta != null ? usersMeta.getTotalCount() : 0L,
            usersMeta != null ? usersMeta.getActiveCount() : 0L,
            usersMeta != null ? usersMeta.getBlockedCount() : 0L,
            totalJobs,
            pendingJobs,
            failedJobs,
            processingJobs,
            completedJobs,
            recentSongs,
            recentJobs
        );
    }
}

package me.one_org.melody.Dto.Controllers.Admin;

import java.util.List;
import me.one_org.melody.Dto.Controllers.Admin.Queue.QueueBackpressureSummaryDto;
import me.one_org.melody.Entity.JobsEntity;
import me.one_org.melody.Entity.SongsEntity;

public record DashboardStatsDto(
    long totalSongs,
    long activeSongs,
    long featuredSongs,
    long totalArtists,
    long activeArtists,
    long totalPlaylists,
    long activePlaylists,
    long totalUsers,
    long activeUsers,
    long blockedUsers,
    long totalJobs,
    long pendingJobs,
    long failedJobs,
    long processingJobs,
    long completedJobs,
    List<SongsEntity> recentSongs,
    List<JobsEntity> recentJobs,
    QueueBackpressureSummaryDto queueStats
) {}

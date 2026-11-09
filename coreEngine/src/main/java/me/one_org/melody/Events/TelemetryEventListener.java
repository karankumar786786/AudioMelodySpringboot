package me.one_org.melody.Events;

import java.util.List;
import java.util.UUID;

import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.AlgoliaSearch.AlgoliaSearch;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Entity.SongMetadata;
import me.one_org.melody.Recommendation.Recombee;
import me.one_org.melody.Repository.SongMetadataRepository;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Services.Api.ArtistApiService;
import me.one_org.melody.Utils.RetryUtil;

@Component
@Slf4j
public class TelemetryEventListener {

    private final Recombee recombee;
    private final ArtistApiService artistApiService;
    private final AlgoliaSearch algoliaSearch;
    private final SongMetadataRepository songMetadataRepository;
    private final SongsRepository songsRepository;

    public TelemetryEventListener(Recombee recombee,
                                  @Lazy ArtistApiService artistApiService,
                                  AlgoliaSearch algoliaSearch,
                                  SongMetadataRepository songMetadataRepository,
                                  SongsRepository songsRepository) {
        this.recombee = recombee;
        this.artistApiService = artistApiService;
        this.algoliaSearch = algoliaSearch;
        this.songMetadataRepository = songMetadataRepository;
        this.songsRepository = songsRepository;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onArtistFollow(TelemetryEvents.ArtistFollowEvent event) {
        RetryUtil.executeWithRetry(
                () -> recombee.trackArtistFollow(event.userId(), event.artistId()),
                3, 500L, "Recombee trackArtistFollow [" + event.artistId() + "]", log
        );
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onArtistUnfollow(TelemetryEvents.ArtistUnfollowEvent event) {
        RetryUtil.executeWithRetry(
                () -> recombee.trackArtistUnfollow(event.userId(), event.artistId()),
                3, 500L, "Recombee trackArtistUnfollow [" + event.artistId() + "]", log
        );
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onSongPlay(TelemetryEvents.SongPlayEvent event) {
        // Evaluate industry-standard 30-second stream qualification rule
        int durationSec = 180;
        try {
            Song song = songsRepository.findById(event.songId()).orElse(null);
            if (song != null && song.getDuration() != null && song.getDuration() > 0) {
                durationSec = song.getDuration();
            }
        } catch (Exception e) {
            log.warn("Could not determine duration for song [{}], fallback to 180s: {}", event.songId(), e.getMessage());
        }

        double listenedSeconds = event.percentage() * durationSec;
        boolean qualifiesAsStream = (listenedSeconds >= 30.0) || (durationSec < 30 && event.percentage() >= 0.5);

        if (qualifiesAsStream) {
            long currentStreams = 1L;
            try {
                int updated = songMetadataRepository.incrementStreams(event.songId());
                if (updated == 0) {
                    try {
                        Song songRef = songsRepository.getReferenceById(event.songId());
                        SongMetadata meta = SongMetadata.builder()
                                .id(UUID.randomUUID().toString())
                                .song(songRef)
                                .totalStreams(1L)
                                .build();
                        songMetadataRepository.save(meta);
                        currentStreams = 1L;
                    } catch (Exception ex) {
                        songMetadataRepository.incrementStreams(event.songId());
                        currentStreams = songMetadataRepository.findBySong_Id(event.songId())
                                .map(sm -> sm.getTotalStreams() != null ? sm.getTotalStreams() : 1L)
                                .orElse(1L);
                    }
                } else {
                    currentStreams = songMetadataRepository.findBySong_Id(event.songId())
                            .map(sm -> sm.getTotalStreams() != null ? sm.getTotalStreams() : 1L)
                            .orElse(1L);
                }
            } catch (Exception e) {
                log.warn("Failed to increment stream count in database for song [{}]: {}", event.songId(), e.getMessage());
            }

            final long finalStreams = currentStreams;
            RetryUtil.executeWithRetry(
                    () -> algoliaSearch.incrementTotalStreams(event.songId()),
                    3, 500L, "Algolia incrementTotalStreams [" + event.songId() + "]", log
            );

            RetryUtil.executeWithRetry(
                    () -> recombee.updateTotalStreams(event.songId(), finalStreams),
                    3, 500L, "Recombee updateTotalStreams [" + event.songId() + "]", log
            );
        } else {
            log.debug("Play event for song [{}] did not qualify as official stream (listened {:.1f}s / {}s). Stream count unchanged.",
                    event.songId(), listenedSeconds, durationSec);
        }

        // Always inform Recombee of user listening signal (scaled rating based on completion percentage)
        RetryUtil.executeWithRetry(
                () -> recombee.trackPlay(event.userId(), event.songId(), event.percentage()),
                3, 500L, "Recombee trackPlay user [" + event.userId() + "] song [" + event.songId() + "]", log
        );
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onSongFavourite(TelemetryEvents.SongFavouriteEvent event) {
        RetryUtil.executeWithRetry(() -> {
            if (event.isAdd()) {
                recombee.trackFavouriteAdd(event.userId(), event.songId());
            } else {
                recombee.trackFavouriteRemove(event.userId(), event.songId());
            }
        }, 3, 500L, "Recombee trackFavourite [" + event.songId() + "]", log);
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onPlaylistSong(TelemetryEvents.PlaylistSongEvent event) {
        RetryUtil.executeWithRetry(() -> {
            if (event.isAdd()) {
                recombee.trackPlaylistAdd(event.userId(), event.songId());
            } else {
                recombee.trackPlaylistRemove(event.userId(), event.songId());
            }
        }, 3, 500L, "Recombee trackPlaylistSong [" + event.songId() + "]", log);
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onOnboardingSeeded(TelemetryEvents.OnboardingSeededEvent event) {
        RetryUtil.executeWithRetry(
                () -> recombee.addUser(event.userId()),
                3, 500L, "Recombee addUser [" + event.userId() + "]", log
        );

        for (String artistId : event.followedArtistIds()) {
            try {
                List<SongDto> topSongs = artistApiService.getArtistSongsPaginated(artistId, 0, 3);
                for (SongDto song : topSongs) {
                    RetryUtil.executeWithRetry(
                            () -> recombee.trackPlay(event.userId(), song.id(), 0.95),
                            2, 300L, "Recombee onboard seed play [" + song.id() + "]", null
                    );
                }
            } catch (Exception ignored) {}
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onUserRegistered(TelemetryEvents.UserRegisteredEvent event) {
        RetryUtil.executeWithRetry(
                () -> recombee.addUser(event.userId()),
                3, 500L, "Recombee register user [" + event.userId() + "]", log
        );
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onUserLogin(TelemetryEvents.UserLoginEvent event) {
        log.info("User login telemetry: userId [{}], email [{}], device [{} ({})], ip [{}], location [{}]",
                event.userId(), event.email(), event.deviceId(), event.deviceName(), event.ipAddress(), event.location());
    }
}

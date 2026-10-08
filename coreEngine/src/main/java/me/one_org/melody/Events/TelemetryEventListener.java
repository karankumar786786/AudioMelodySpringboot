package me.one_org.melody.Events;

import java.util.List;

import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Recommendation.Recombee;
import me.one_org.melody.Services.Api.ArtistApiService;

@Component
@Slf4j
public class TelemetryEventListener {

    private final Recombee recombee;
    private final ArtistApiService artistApiService;

    public TelemetryEventListener(Recombee recombee, @Lazy ArtistApiService artistApiService) {
        this.recombee = recombee;
        this.artistApiService = artistApiService;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onArtistFollow(TelemetryEvents.ArtistFollowEvent event) {
        try {
            recombee.trackArtistFollow(event.userId(), event.artistId());
            log.info("Tracked artist follow in Recombee for user [{}] artist [{}]", event.userId(), event.artistId());
        } catch (Exception e) {
            log.error("Failed to track artist follow in Recombee for user [{}] artist [{}]: {}", event.userId(), event.artistId(), e.getMessage());
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onArtistUnfollow(TelemetryEvents.ArtistUnfollowEvent event) {
        try {
            recombee.trackArtistUnfollow(event.userId(), event.artistId());
            log.info("Tracked artist unfollow in Recombee for user [{}] artist [{}]", event.userId(), event.artistId());
        } catch (Exception e) {
            log.error("Failed to track artist unfollow in Recombee for user [{}] artist [{}]: {}", event.userId(), event.artistId(), e.getMessage());
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onSongPlay(TelemetryEvents.SongPlayEvent event) {
        try {
            recombee.trackPlay(event.userId(), event.songId(), event.percentage());
        } catch (Exception e) {
            log.error("Failed to track play in Recombee for user [{}] song [{}]: {}", event.userId(), event.songId(), e.getMessage());
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onSongFavourite(TelemetryEvents.SongFavouriteEvent event) {
        try {
            if (event.isAdd()) {
                recombee.trackFavouriteAdd(event.userId(), event.songId());
            } else {
                recombee.trackFavouriteRemove(event.userId(), event.songId());
            }
        } catch (Exception e) {
            log.error("Failed to track favourite in Recombee: {}", e.getMessage());
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onPlaylistSong(TelemetryEvents.PlaylistSongEvent event) {
        try {
            if (event.isAdd()) {
                recombee.trackPlaylistAdd(event.userId(), event.songId());
            } else {
                recombee.trackPlaylistRemove(event.userId(), event.songId());
            }
        } catch (Exception e) {
            log.warn("Failed to track playlist song in Recombee: {}", e.getMessage());
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onOnboardingSeeded(TelemetryEvents.OnboardingSeededEvent event) {
        try {
            recombee.addUser(event.userId());
        } catch (Exception ignored) {}

        for (String artistId : event.followedArtistIds()) {
            try {
                List<SongsEntity> topSongs = artistApiService.getArtistSongsPaginated(artistId, 0, 3);
                for (SongsEntity song : topSongs) {
                    try {
                        recombee.trackPlay(event.userId(), song.getId(), 0.95);
                    } catch (Exception ignored) {}
                }
            } catch (Exception ignored) {}
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onUserRegistered(TelemetryEvents.UserRegisteredEvent event) {
        try {
            recombee.addUser(event.userId());
            log.info("Registered new user [{}] in Recombee", event.userId());
        } catch (Exception e) {
            log.warn("Failed to register new user in Recombee: {}", e.getMessage());
        }
    }
}

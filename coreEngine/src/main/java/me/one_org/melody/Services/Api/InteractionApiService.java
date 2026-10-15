package me.one_org.melody.Services.Api;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.AlgoliaSearch.AlgoliaSearch;
import me.one_org.melody.Entity.PaginationMetaData;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Entity.User;
import me.one_org.melody.Entity.UserHistory;
import me.one_org.melody.Recommendation.Recombee;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Repository.UserHistoryRepository;
import me.one_org.melody.Repository.UsersRepository;
import me.one_org.melody.Services.General.PaginationMetaDataService;

import org.springframework.context.ApplicationEventPublisher;
import me.one_org.melody.Events.TelemetryEvents;

@Service
@Slf4j
public class InteractionApiService {

    private final Recombee recombee;
    private final UsersRepository usersRepository;
    private final SongsRepository songsRepository;
    private final UserHistoryRepository userHistoryRepository;
    private final PaginationMetaDataService paginationMetaDataService;
    private final AlgoliaSearch algoliaSearch;
    private final ApplicationEventPublisher eventPublisher;

    public InteractionApiService(Recombee recombee, UsersRepository usersRepository,
                                  SongsRepository songsRepository, UserHistoryRepository userHistoryRepository,
                                  PaginationMetaDataService paginationMetaDataService,
                                  AlgoliaSearch algoliaSearch,
                                  ApplicationEventPublisher eventPublisher) {
        this.recombee = recombee;
        this.usersRepository = usersRepository;
        this.songsRepository = songsRepository;
        this.userHistoryRepository = userHistoryRepository;
        this.paginationMetaDataService = paginationMetaDataService;
        this.algoliaSearch = algoliaSearch;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public void trackPlay(String userId, String songId, double percentage) {
        Song song = songsRepository.findById(songId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Song not found"));
        User user = getUser(userId);

        // Calculate listen part (percentage bucket)
        int part = (int) (percentage * 100);

        // Save to listening history
        UserHistory history = UserHistory.builder()
                .id(UUID.randomUUID().toString())
                .user(user)
                .song(song)
                .part(part)
                .build();
        userHistoryRepository.save(history);

        // Emit telemetry event AFTER_COMMIT
        eventPublisher.publishEvent(new TelemetryEvents.SongPlayEvent(userId, songId, percentage));
        log.info("saved song in history");
    }

    public void trackSkip(String userId, String songId) {
        try {
            recombee.trackSkip(userId, songId);
        } catch (Exception e) {
            log.error("Failed to track skip in Recombee: {}", e.getMessage());
        }
    }

    public void trackSearchPlay(String userId, String songId) {
        try {
            algoliaSearch.incrementSearchCount(songId);
        } catch (Exception e) {
            log.warn("Failed to increment search count in Algolia for song {}: {}", songId, e.getMessage());
        }

        if (userId != null) {
            try {
                recombee.trackSearchPlay(userId, songId);
            } catch (Exception e) {
                log.error("Failed to track search-play in Recombee for user [{}] song [{}]: {}", userId, songId, e.getMessage());
            }
        }
    }

    public void trackSearchClick(String userId, String type, String entityId) {
        try {
            algoliaSearch.incrementSearchCount(entityId);
        } catch (Exception e) {
            log.warn("Failed to increment search count in Algolia for type {} id {}: {}", type, entityId, e.getMessage());
        }

        if ("SONG".equalsIgnoreCase(type) && userId != null) {
            try {
                recombee.trackSearchPlay(userId, entityId);
            } catch (Exception ignored) {
            }
        }
    }

    public void trackQueueAdd(String userId, String songId) {
        try {
            recombee.trackQueueAdd(userId, songId);
        } catch (Exception e) {
            log.error("Failed to track queue-add in Recombee for user [{}] song [{}]: {}", userId, songId, e.getMessage());
        }
    }

    public void trackQueueRemove(String userId, String songId) {
        try {
            recombee.trackQueueRemove(userId, songId);
        } catch (Exception e) {
            log.error("Failed to track queue-remove in Recombee for user [{}] song [{}]: {}", userId, songId, e.getMessage());
        }
    }

    public void trackDislike(String userId, String songId) {
        if (userId != null && songId != null) {
            try {
                recombee.trackDislike(userId, songId);
                log.info("Tracked dislike signal in Recombee for user [{}] song [{}]", userId, songId);
            } catch (Exception e) {
                log.error("Failed to track dislike in Recombee for user [{}] song [{}]: {}", userId, songId, e.getMessage());
            }
        }
    }

    public void trackShare(String userId, String songId) {
        if (userId != null && songId != null) {
            try {
                recombee.trackShare(userId, songId);
                log.info("Tracked share signal in Recombee for user [{}] song [{}]", userId, songId);
            } catch (Exception e) {
                log.error("Failed to track share in Recombee for user [{}] song [{}]: {}", userId, songId, e.getMessage());
            }
        }
    }

    @Transactional
    public void addFavourite(String userId, String songId) {
        getUser(userId);
        songsRepository.findById(songId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Song not found"));

        int inserted = usersRepository.addFavouriteSong(userId, songId);
        if (inserted > 0) {
            paginationMetaDataService.incrementStatus("UserFavourites_" + userId, null);
        }

        eventPublisher.publishEvent(new TelemetryEvents.SongFavouriteEvent(userId, songId, true));
    }

    @Transactional
    public void removeFavourite(String userId, String songId) {
        getUser(userId);
        int deleted = usersRepository.removeFavouriteSong(userId, songId);
        if (deleted > 0) {
            paginationMetaDataService.decrementStatus("UserFavourites_" + userId, null);
        }

        eventPublisher.publishEvent(new TelemetryEvents.SongFavouriteEvent(userId, songId, false));
    }

    @Transactional(readOnly = true)
    public List<Song> getFavouritesPaginated(String userId, int page, int size) {
        getUser(userId);
        return usersRepository.findFavouriteSongsPaginated(userId, page, size);
    }

    public PaginationMetaData getFavouritesPaginationMetaData(String userId) {
        return paginationMetaDataService.getMetaData("UserFavourites_" + userId);
    }

    private User getUser(String userId) {
        return usersRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }
}

package me.one_org.melody.Services.Api;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

import org.springframework.context.ApplicationEventPublisher;
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
import me.one_org.melody.Events.TelemetryEvents;
import me.one_org.melody.Recommendation.Recombee;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Repository.UserHistoryRepository;
import me.one_org.melody.Repository.UsersRepository;
import me.one_org.melody.Services.General.PaginationMetaDataService;

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
        if (songId == null || songId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Song ID cannot be empty");
        }
        if (!songsRepository.existsById(songId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Song not found");
        }
        if (!usersRepository.existsById(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }

        // Use JPA entity reference proxies to assign foreign keys without loading entire column rows
        Song songRef = songsRepository.getReferenceById(songId);
        User userRef = usersRepository.getReferenceById(userId);

        // Clamp listen percentage bucket (0 - 100%)
        double clampedPercentage = Math.max(0.0, Math.min(1.0, percentage));
        int part = (int) (clampedPercentage * 100);

        // Save to listening history
        UserHistory history = UserHistory.builder()
                .id(UUID.randomUUID().toString())
                .user(userRef)
                .song(songRef)
                .part(part)
                .build();
        userHistoryRepository.save(history);

        // Keep pagination metadata for history in sync
        paginationMetaDataService.incrementStatus("UserHistory_" + userId, null);

        // Emit telemetry event AFTER_COMMIT
        eventPublisher.publishEvent(new TelemetryEvents.SongPlayEvent(userId, songId, clampedPercentage));
        log.info("Saved song [{}] in user history for user [{}]", songId, userId);
    }

    public void trackSkip(String userId, String songId) {
        if (songId == null || songId.isBlank()) return;
        try {
            recombee.trackSkip(userId, songId);
        } catch (Exception e) {
            log.error("Failed to track skip in Recombee: {}", e.getMessage());
        }
    }

    public void trackSearchPlay(String userId, String songId) {
        if (songId == null || songId.isBlank()) return;
        try {
            algoliaSearch.incrementSearchCount(songId);
        } catch (Exception e) {
            log.warn("Failed to increment search count in Algolia for song {}: {}", songId, e.getMessage());
        }

        if (userId != null && !userId.isBlank()) {
            try {
                recombee.trackSearchPlay(userId, songId);
            } catch (Exception e) {
                log.error("Failed to track search-play in Recombee for user [{}] song [{}]: {}", userId, songId, e.getMessage());
            }
        }
    }

    public void trackSearchClick(String userId, String type, String entityId) {
        if (entityId == null || entityId.isBlank()) return;
        try {
            algoliaSearch.incrementSearchCount(entityId);
        } catch (Exception e) {
            log.warn("Failed to increment search count in Algolia for type {} id {}: {}", type, entityId, e.getMessage());
        }

        if ("SONG".equalsIgnoreCase(type) && userId != null && !userId.isBlank()) {
            try {
                recombee.trackSearchPlay(userId, entityId);
            } catch (Exception ignored) {
            }
        }
    }

    public void trackQueueAdd(String userId, String songId) {
        if (songId == null || songId.isBlank()) return;
        try {
            recombee.trackQueueAdd(userId, songId);
        } catch (Exception e) {
            log.error("Failed to track queue-add in Recombee for user [{}] song [{}]: {}", userId, songId, e.getMessage());
        }
    }

    public void trackQueueRemove(String userId, String songId) {
        if (songId == null || songId.isBlank()) return;
        try {
            recombee.trackQueueRemove(userId, songId);
        } catch (Exception e) {
            log.error("Failed to track queue-remove in Recombee for user [{}] song [{}]: {}", userId, songId, e.getMessage());
        }
    }

    public void trackDislike(String userId, String songId) {
        if (userId != null && songId != null && !songId.isBlank()) {
            try {
                recombee.trackDislike(userId, songId);
                log.info("Tracked dislike signal in Recombee for user [{}] song [{}]", userId, songId);
            } catch (Exception e) {
                log.error("Failed to track dislike in Recombee for user [{}] song [{}]: {}", userId, songId, e.getMessage());
            }
        }
    }

    public void trackShare(String userId, String songId) {
        if (userId != null && songId != null && !songId.isBlank()) {
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
        if (songId == null || songId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Song ID cannot be empty");
        }

        // Fast existence checks without hydrating full entity models into memory
        if (!songsRepository.existsById(songId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Song not found");
        }
        if (!usersRepository.existsById(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }

        int inserted = usersRepository.addFavouriteSong(userId, songId);
        if (inserted > 0) {
            paginationMetaDataService.incrementStatus("UserFavourites_" + userId, null);
            eventPublisher.publishEvent(new TelemetryEvents.SongFavouriteEvent(userId, songId, true));
        }
    }

    @Transactional
    public void removeFavourite(String userId, String songId) {
        if (songId == null || songId.isBlank()) return;

        int deleted = usersRepository.removeFavouriteSong(userId, songId);
        if (deleted > 0) {
            paginationMetaDataService.decrementStatus("UserFavourites_" + userId, null);
            eventPublisher.publishEvent(new TelemetryEvents.SongFavouriteEvent(userId, songId, false));
        } else if (!usersRepository.existsById(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }
    }

    @Transactional(readOnly = true)
    public List<Song> getFavouritesPaginated(String userId, int page, int size) {
        if (userId == null || userId.isBlank() || size <= 0 || page < 0) {
            return Collections.emptyList();
        }

        // Optimization: Use cached pagination metadata as an early boundary guard
        // Prevents querying PostgreSQL join table if user has 0 favourites or requesting past the end
        PaginationMetaData meta = paginationMetaDataService.getMetaData("UserFavourites_" + userId);
        if (meta == null || meta.getTotalCount() == 0 || (long) page * size >= meta.getTotalCount()) {
            return Collections.emptyList();
        }

        return usersRepository.findFavouriteSongsPaginated(userId, page, size);
    }

    public PaginationMetaData getFavouritesPaginationMetaData(String userId) {
        return paginationMetaDataService.getMetaData("UserFavourites_" + userId);
    }
}

package me.one_org.melody.Services.Api;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.AlgoliaSearch.AlgoliaSearch;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Entity.UserHistoryEntity;
import me.one_org.melody.Entity.UsersEntity;
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

    public InteractionApiService(Recombee recombee, UsersRepository usersRepository,
                                  SongsRepository songsRepository, UserHistoryRepository userHistoryRepository,
                                  PaginationMetaDataService paginationMetaDataService,
                                  AlgoliaSearch algoliaSearch) {
        this.recombee = recombee;
        this.usersRepository = usersRepository;
        this.songsRepository = songsRepository;
        this.userHistoryRepository = userHistoryRepository;
        this.paginationMetaDataService = paginationMetaDataService;
        this.algoliaSearch = algoliaSearch;
    }

    @Transactional
    public void trackPlay(String userId, String songId, double percentage) {
        SongsEntity song = songsRepository.findById(songId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Song not found"));
        UsersEntity user = getUser(userId);

        // Calculate listen part (percentage bucket)
        int part = (int) (percentage * 100);

        // Save to listening history
        UserHistoryEntity history = UserHistoryEntity.builder()
                .id(UUID.randomUUID().toString())
                .user(user)
                .song(song)
                .part(part)
                .build();
        userHistoryRepository.save(history);

        // Track in Recombee
        try {
            recombee.trackPlay(userId, songId, percentage);
        } catch (Exception e) {
            log.error("Failed to track play in Recombee: {}", e.getMessage());
        }
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

    @Transactional
    public void addFavourite(String userId, String songId) {
        UsersEntity user = getUser(userId);
        SongsEntity song = songsRepository.findById(songId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Song not found"));

        if (user.getFavouriteSongs().add(song)) {
            usersRepository.save(user);
            paginationMetaDataService.incrementStatus("UserFavourites_" + userId, null);
        }

        try {
            recombee.trackFavouriteAdd(userId, songId);
        } catch (Exception e) {
            log.error("Failed to track favourite add in Recombee: {}", e.getMessage());
        }
    }

    @Transactional
    public void removeFavourite(String userId, String songId) {
        UsersEntity user = getUser(userId);
        if (user.getFavouriteSongs().removeIf(s -> s.getId().equals(songId))) {
            usersRepository.save(user);
            paginationMetaDataService.decrementStatus("UserFavourites_" + userId, null);
        }

        try {
            recombee.trackFavouriteRemove(userId, songId);
        } catch (Exception e) {
            log.error("Failed to track favourite remove in Recombee: {}", e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public List<SongsEntity> getFavouritesPaginated(String userId, int page, int size) {
        getUser(userId);
        return usersRepository.findFavouriteSongsPaginated(userId, page, size);
    }

    public me.one_org.melody.Entity.PaginationMetaDataEntity getFavouritesPaginationMetaData(String userId) {
        return paginationMetaDataService.getMetaData("UserFavourites_" + userId);
    }

    private UsersEntity getUser(String userId) {
        return usersRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }
}

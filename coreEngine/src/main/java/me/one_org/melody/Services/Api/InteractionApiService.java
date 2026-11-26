package me.one_org.melody.Services.Api;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import me.one_org.melody.Exceptions.BadRequestException;
import me.one_org.melody.Exceptions.ResourceNotFoundException;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.AlgoliaSearch.AlgoliaSearch;
import me.one_org.melody.Dto.Controllers.Api.PaginationMetaDataDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Entity.User;
import me.one_org.melody.Entity.UserHistory;
import me.one_org.melody.Events.TelemetryEvents;
import me.one_org.melody.Recommendation.Recombee;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Repository.UserHistoryRepository;
import me.one_org.melody.Repository.UsersRepository;
import me.one_org.melody.Services.General.PaginationMetaDataService;

/**
 * User activity ka PURANA (LEGACY/DUAL) raasta: play history likhna, skip/search/queue ke signals,
 * aur favourites. Bahar ki services ko events ke through (commit ke baad) batate hain.
 *
 * Service = asli business logic. Controller isko call karta hai, ye repositories (DB), cache aur
 * bahar ki services (Recombee, Algolia) ko use karta hai.
 * @Transactional(readOnly = true) = by default sirf padhne wale DB transactions (thode fast);
 * jo methods data badalte hain un pe alag se @Transactional laga hai.
 * @Cacheable = result Redis me cache hota hai (RedisConfig dekho).
 */
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

    /**
     * Gaana suna: user_history me row likho (part = kitna % suna), history count badhao,
     * aur SongPlayEvent bhejo (streams count + Recombee wala kaam listener karega).
     */
    @Transactional
    public void trackPlay(String userId, String songId, double percentage) {
        if (songId == null || songId.isBlank()) {
            throw new BadRequestException("Song ID cannot be empty");
        }
        if (!songsRepository.existsById(songId)) {
            throw new ResourceNotFoundException("Song not found");
        }
        if (!usersRepository.existsById(userId)) {
            throw new ResourceNotFoundException("User not found");
        }

        // getReferenceById = sirf id wala proxy object; foreign key set ho jaati hai bina poori row load kiye
        Song songRef = songsRepository.getReferenceById(songId);
        User userRef = usersRepository.getReferenceById(userId);

        // Kitna suna: 0 se 100 ke beech rakho
        double clampedPercentage = Math.max(0.0, Math.min(1.0, percentage));
        int part = (int) (clampedPercentage * 100);

        // Listening history me row likho
        UserHistory history = UserHistory.builder()
                .id(UUID.randomUUID().toString())
                .user(userRef)
                .song(songRef)
                .part(part)
                .build();
        userHistoryRepository.save(history);

        // History ka count bhi badhao
        paginationMetaDataService.incrementStatus("UserHistory_" + userId, null);

        // Event bhejo - listeners commit ke baad chalenge
        eventPublisher.publishEvent(new TelemetryEvents.SongPlayEvent(userId, songId, clampedPercentage));
    }

    /** Skip -> Recombee ko negative signal (seedhi call; fail ho to sirf log). */
    public void trackSkip(String userId, String songId) {
        if (songId == null || songId.isBlank()) return;
        try {
            recombee.trackSkip(userId, songId);
        } catch (Exception e) {
            log.error("Failed to track skip in Recombee: {}", e.getMessage());
        }
    }

    /** Search se play -> Recombee ko strong signal + Algolia me searchCount +1. */
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

    /** Search result pe click -> Algolia me searchCount +1, aur song ho to Recombee ko bhi signal. */
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

    /** Queue me joda -> Recombee ko halka positive signal. */
    public void trackQueueAdd(String userId, String songId) {
        if (songId == null || songId.isBlank()) return;
        try {
            recombee.trackQueueAdd(userId, songId);
        } catch (Exception e) {
            log.error("Failed to track queue-add in Recombee for user [{}] song [{}]: {}", userId, songId, e.getMessage());
        }
    }

    /** Queue se hataya -> Recombee ko halka negative signal. */
    public void trackQueueRemove(String userId, String songId) {
        if (songId == null || songId.isBlank()) return;
        try {
            recombee.trackQueueRemove(userId, songId);
        } catch (Exception e) {
            log.error("Failed to track queue-remove in Recombee for user [{}] song [{}]: {}", userId, songId, e.getMessage());
        }
    }

    /** Dislike -> Recombee ko negative signal. */
    public void trackDislike(String userId, String songId) {
        if (userId != null && songId != null && !songId.isBlank()) {
            try {
                recombee.trackDislike(userId, songId);
            } catch (Exception e) {
                log.error("Failed to track dislike in Recombee for user [{}] song [{}]: {}", userId, songId, e.getMessage());
            }
        }
    }

    /** Share -> Recombee ko positive signal. */
    public void trackShare(String userId, String songId) {
        if (userId != null && songId != null && !songId.isBlank()) {
            try {
                recombee.trackShare(userId, songId);
            } catch (Exception e) {
                log.error("Failed to track share in Recombee for user [{}] song [{}]: {}", userId, songId, e.getMessage());
            }
        }
    }

    /**
     * Favourite me jodo (user aur song hone chahiye, warna 404). Pehle se ho to kuch nahi.
     * Event bhejte hain taaki Recombee / Kafka ko pata chale.
     */
    @Transactional
    public void addFavourite(String userId, String songId) {
        if (songId == null || songId.isBlank()) {
            throw new BadRequestException("Song ID cannot be empty");
        }

        // Sirf "hai ya nahi" check - poore objects load nahi karte
        if (!songsRepository.existsById(songId)) {
            throw new ResourceNotFoundException("Song not found");
        }
        if (!usersRepository.existsById(userId)) {
            throw new ResourceNotFoundException("User not found");
        }

        int inserted = usersRepository.addFavouriteSong(userId, songId);
        if (inserted > 0) {
            paginationMetaDataService.incrementStatus("UserFavourites_" + userId, null);
            eventPublisher.publishEvent(new TelemetryEvents.SongFavouriteEvent(userId, songId, true));
        }
    }

    /** Favourite se hatao aur event bhejo. */
    @Transactional
    public void removeFavourite(String userId, String songId) {
        if (songId == null || songId.isBlank()) return;

        int deleted = usersRepository.removeFavouriteSong(userId, songId);
        if (deleted > 0) {
            paginationMetaDataService.decrementStatus("UserFavourites_" + userId, null);
            eventPublisher.publishEvent(new TelemetryEvents.SongFavouriteEvent(userId, songId, false));
        } else if (!usersRepository.existsById(userId)) {
            throw new ResourceNotFoundException("User not found");
        }
    }

    /** Favourite songs, page by page (har song pe isLiked = true). */
    @Transactional(readOnly = true)
    public List<SongDto> getFavouritesPaginated(String userId, int page, int size) {
        if (userId == null || userId.isBlank() || size <= 0 || page < 0) {
            return Collections.emptyList();
        }

        return usersRepository.findFavouriteSongsPaginated(userId, page, size).stream()
                .map(SongDto::fromEntity)
                .toList();
    }

    /** Kitne favourites hain. */
    public PaginationMetaDataDto getFavouritesPaginationMetaData(String userId) {
        if (userId == null || userId.isBlank()) {
            return null;
        }
        long count = usersRepository.countFavouriteSongs(userId);
        return new PaginationMetaDataDto(
                "meta_user_favourites_" + userId,
                "UserFavourites_" + userId,
                count,
                count,
                0L,
                0L,
                LocalDateTime.now()
        );
    }
}

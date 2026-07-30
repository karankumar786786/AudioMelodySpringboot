package me.one_org.melody.Services.App;

import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Entity.UserHistoryEntity;
import me.one_org.melody.Entity.UsersEntity;
import me.one_org.melody.Recommendation.Recombee;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Repository.UserHistoryRepository;
import me.one_org.melody.Repository.UsersRepository;

import me.one_org.melody.Services.Genral.PaginationMetaDataService;

@Service
@Slf4j
public class InteractionAppService {

    private final Recombee recombee;
    private final UsersRepository usersRepository;
    private final SongsRepository songsRepository;
    private final UserHistoryRepository userHistoryRepository;
    private final PaginationMetaDataService paginationMetaDataService;

    public InteractionAppService(Recombee recombee, UsersRepository usersRepository,
                                  SongsRepository songsRepository, UserHistoryRepository userHistoryRepository,
                                  PaginationMetaDataService paginationMetaDataService) {
        this.recombee = recombee;
        this.usersRepository = usersRepository;
        this.songsRepository = songsRepository;
        this.userHistoryRepository = userHistoryRepository;
        this.paginationMetaDataService = paginationMetaDataService;
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
        paginationMetaDataService.incrementStatus("UserHistory_" + userId, null);

        // Track in Recombee
        try {
            recombee.trackPlay(userId, songId, percentage);
        } catch (Exception e) {
            log.error("Failed to track play in Recombee: {}", e.getMessage());
        }
    }

    public void trackSkip(String userId, String songId) {
        try {
            recombee.trackSkip(userId, songId);
        } catch (Exception e) {
            log.error("Failed to track skip in Recombee: {}", e.getMessage());
        }
    }

    @Transactional
    public void addFavourite(String userId, String songId) {
        UsersEntity user = getUser(userId);
        SongsEntity song = songsRepository.findById(songId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Song not found"));

        user.getFavouriteSongs().add(song);
        usersRepository.save(user);

        try {
            recombee.trackFavouriteAdd(userId, songId);
        } catch (Exception e) {
            log.error("Failed to track favourite add in Recombee: {}", e.getMessage());
        }
    }

    @Transactional
    public void removeFavourite(String userId, String songId) {
        UsersEntity user = getUser(userId);
        user.getFavouriteSongs().removeIf(s -> s.getId().equals(songId));
        usersRepository.save(user);

        try {
            recombee.trackFavouriteRemove(userId, songId);
        } catch (Exception e) {
            log.error("Failed to track favourite remove in Recombee: {}", e.getMessage());
        }
    }

    public Set<SongsEntity> getFavourites(String userId) {
        UsersEntity user = getUser(userId);
        return user.getFavouriteSongs();
    }

    private UsersEntity getUser(String userId) {
        return usersRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }
}

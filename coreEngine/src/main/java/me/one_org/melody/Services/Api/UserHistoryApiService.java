package me.one_org.melody.Services.Api;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import me.one_org.melody.Dto.Controllers.Api.UserHistoryResponseDto;
import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Entity.UserHistoryEntity;
import me.one_org.melody.Entity.UserSearchHistoryEntity;
import me.one_org.melody.Entity.UsersEntity;
import me.one_org.melody.Repository.UserHistoryRepository;
import me.one_org.melody.Repository.UserSearchHistoryRepository;
import me.one_org.melody.Repository.UsersRepository;
import me.one_org.melody.Services.General.PaginationMetaDataService;

@Service
public class UserHistoryApiService {

    private final UserHistoryRepository userHistoryRepository;
    private final UsersRepository usersRepository;
    private final PaginationMetaDataService paginationMetaDataService;
    private final UserSearchHistoryRepository searchHistoryRepository;

    public UserHistoryApiService(UserHistoryRepository userHistoryRepository,
                                 UsersRepository usersRepository,
                                 PaginationMetaDataService paginationMetaDataService,
                                 UserSearchHistoryRepository searchHistoryRepository) {
        this.userHistoryRepository = userHistoryRepository;
        this.usersRepository = usersRepository;
        this.paginationMetaDataService = paginationMetaDataService;
        this.searchHistoryRepository = searchHistoryRepository;
    }

    public List<UserHistoryResponseDto> getHistory(String userId, int page, int size) {
        UsersEntity user = getUser(userId);
        List<UserHistoryEntity> history = userHistoryRepository.findByUserOrderByListenedAtDesc(user, page, size);
        return history.stream()
                .map(this::mapToDto)
                .toList();
    }

    public PaginationMetaDataEntity getPaginationMetaData(String userId) {
        return paginationMetaDataService.getMetaData("UserHistory_" + userId);
    }


    public List<UserSearchHistoryEntity> getSearchHistory(String userId) {
        UsersEntity user = getUser(userId);
        return searchHistoryRepository.findByUser(user);
    }

    public List<UserHistoryResponseDto> getRecentlyPlayed(String userId) {
        UsersEntity user = getUser(userId);
        List<UserHistoryEntity> recent = userHistoryRepository.findRecentByUser(user, 10);
        return recent.stream()
                .map(this::mapToDto)
                .toList();
    }

    public void saveSearchHistory(String userId, String searchText) {
        UsersEntity user = getUser(userId);
        UserSearchHistoryEntity history = UserSearchHistoryEntity.builder()
                .id(java.util.UUID.randomUUID().toString())
                .user(user)
                .searchedText(searchText)
                .build();
        searchHistoryRepository.save(history);
    }

    private UsersEntity getUser(String userId) {
        return usersRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private UserHistoryResponseDto mapToDto(UserHistoryEntity history) {
        var song = history.getSong();
        return new UserHistoryResponseDto(
                history.getId(),
                song.getId(),
                song.getTitle(),
                song.getArtistName(),
                song.getDuration(),
                song.getSongKey(),
                song.getImageKey(),
                song.getLanguage(),
                song.getLrclibId(),
                song.getStatus() != null ? song.getStatus().name() : null,
                song.getCreatedAt(),
                history.getPart(),
                history.getListenedAt()
        );
    }
}

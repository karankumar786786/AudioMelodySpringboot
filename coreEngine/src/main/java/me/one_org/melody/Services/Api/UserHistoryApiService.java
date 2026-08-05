package me.one_org.melody.Services.Api;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

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

    public List<UserHistoryEntity> getHistory(String userId, int page, int size) {
        UsersEntity user = getUser(userId);
        return userHistoryRepository.findByUserOrderByListenedAtDesc(user, page, size);
    }

    public PaginationMetaDataEntity getPaginationMetaData(String userId) {
        return paginationMetaDataService.getMetaData("UserHistory_" + userId);
    }

    @Transactional
    public void clearHistory(String userId) {
        UsersEntity user = getUser(userId);
        userHistoryRepository.deleteByUser(user);
        paginationMetaDataService.updateCounts("UserHistory_" + userId, 0L, 0L, 0L, 0L);
    }

    public List<UserSearchHistoryEntity> getSearchHistory(String userId) {
        UsersEntity user = getUser(userId);
        return searchHistoryRepository.findByUser(user);
    }

    @Transactional
    public void clearSearchHistory(String userId) {
        UsersEntity user = getUser(userId);
        searchHistoryRepository.deleteByUser(user);
    }

    private UsersEntity getUser(String userId) {
        return usersRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }
}

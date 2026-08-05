package me.one_org.melody.Services.Api;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Entity.UserHistoryEntity;
import me.one_org.melody.Entity.UsersEntity;
import me.one_org.melody.Repository.UserHistoryRepository;
import me.one_org.melody.Repository.UsersRepository;
import me.one_org.melody.Services.General.PaginationMetaDataService;

@Service
public class UserHistoryApiService {

    private final UserHistoryRepository userHistoryRepository;
    private final UsersRepository usersRepository;
    private final PaginationMetaDataService paginationMetaDataService;

    public UserHistoryApiService(UserHistoryRepository userHistoryRepository,
                                 UsersRepository usersRepository,
                                 PaginationMetaDataService paginationMetaDataService) {
        this.userHistoryRepository = userHistoryRepository;
        this.usersRepository = usersRepository;
        this.paginationMetaDataService = paginationMetaDataService;
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

    private UsersEntity getUser(String userId) {
        return usersRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }
}

package me.one_org.melody.Services.App;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import me.one_org.melody.Entity.UserHistoryEntity;
import me.one_org.melody.Entity.UsersEntity;
import me.one_org.melody.Repository.UserHistoryRepository;
import me.one_org.melody.Repository.UsersRepository;

@Service
public class UserHistoryAppService {

    private final UserHistoryRepository userHistoryRepository;
    private final UsersRepository usersRepository;

    public UserHistoryAppService(UserHistoryRepository userHistoryRepository, UsersRepository usersRepository) {
        this.userHistoryRepository = userHistoryRepository;
        this.usersRepository = usersRepository;
    }

    public List<UserHistoryEntity> getHistory(String userId, int page, int size) {
        UsersEntity user = getUser(userId);
        return userHistoryRepository.findByUserOrderByListenedAtDesc(user, page, size);
    }

    @Transactional
    public void clearHistory(String userId) {
        UsersEntity user = getUser(userId);
        userHistoryRepository.deleteByUser(user);
    }

    private UsersEntity getUser(String userId) {
        return usersRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }
}

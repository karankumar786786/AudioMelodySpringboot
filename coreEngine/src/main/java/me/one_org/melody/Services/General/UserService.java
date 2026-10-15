package me.one_org.melody.Services.General;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import me.one_org.melody.Entity.User;
import me.one_org.melody.Repository.UsersRepository;

@Service
public class UserService {

    private final UsersRepository usersRepository;

    public UserService(UsersRepository usersRepository) {
        this.usersRepository = usersRepository;
    }

    @Transactional(readOnly = true)
    public User getUserProfile(String userId) {
        return usersRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    @Transactional
    public User updateProfile(String userId, String userName) {
        User user = getUserProfile(userId);
        if (userName != null && !userName.isBlank()) {
            user.setUserName(userName);
            usersRepository.save(user);
        }
        return user;
    }
}

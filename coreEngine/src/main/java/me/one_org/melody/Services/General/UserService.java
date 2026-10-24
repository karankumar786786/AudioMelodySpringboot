package me.one_org.melody.Services.General;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import me.one_org.melody.Entity.User;
import me.one_org.melody.Exceptions.BadRequestException;
import me.one_org.melody.Exceptions.ResourceNotFoundException;
import me.one_org.melody.Repository.UsersRepository;

@Service
public class UserService {

    private final UsersRepository usersRepository;

    public UserService(UsersRepository usersRepository) {
        this.usersRepository = usersRepository;
    }

    @Transactional(readOnly = true)
    public User getUserProfile(String userId) {
        if (userId == null || userId.isBlank()) {
            throw new BadRequestException("User ID is required");
        }
        return usersRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    @Transactional
    public User updateProfile(String userId, String userName) {
        if (userId == null || userId.isBlank()) {
            throw new BadRequestException("User ID is required");
        }
        if (userName == null || userName.isBlank()) {
            throw new BadRequestException("Username cannot be blank");
        }
        User user = getUserProfile(userId);
        user.setUserName(userName.trim());
        User saved = usersRepository.save(user);
        return saved != null ? saved : user;
    }
}

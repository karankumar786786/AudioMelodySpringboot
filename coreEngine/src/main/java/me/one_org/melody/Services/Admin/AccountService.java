package me.one_org.melody.Services.Admin;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import me.one_org.melody.Entity.UsersEntity;
import me.one_org.melody.Recommendation.Recombee;
import me.one_org.melody.Repository.UsersRepository;

@Service
public class AccountService {

    private final UsersRepository usersRepository;
    private final Recombee recombee;

    public AccountService(UsersRepository usersRepository, Recombee recombee) {
        this.usersRepository = usersRepository;
        this.recombee = recombee;
    }

    public List<UsersEntity> getAllAccounts() {
        return usersRepository.findAll();
    }

    @Transactional
    public void deleteAccount(String id) {
        usersRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        try {
            recombee.deleteUser(id);
        } catch (Exception e) {
            // Log but don't fail
        }

        usersRepository.deleteById(id);
    }
}

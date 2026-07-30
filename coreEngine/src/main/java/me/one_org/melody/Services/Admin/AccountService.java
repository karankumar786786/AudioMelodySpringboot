package me.one_org.melody.Services.Admin;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Entity.UsersEntity;
import me.one_org.melody.Enums.RoleEnum;
import me.one_org.melody.Exceptions.ConflictException;
import me.one_org.melody.Exceptions.ResourceNotFoundException;
import me.one_org.melody.Recommendation.Recombee;
import me.one_org.melody.Repository.UsersRepository;
import me.one_org.melody.Services.General.PaginationMetaDataService;

@Service
public class AccountService {

    private final UsersRepository usersRepository;
    private final Recombee recombee;
    private final PaginationMetaDataService paginationMetaDataService;

    public AccountService(UsersRepository usersRepository, Recombee recombee,
                          PaginationMetaDataService paginationMetaDataService) {
        this.usersRepository = usersRepository;
        this.recombee = recombee;
        this.paginationMetaDataService = paginationMetaDataService;
    }

    public List<UsersEntity> getAccountsPaginated(int page, int size) {
        return usersRepository.findAllPaginated(page, size);
    }

    public PaginationMetaDataEntity getPaginationMetaData() {
        return paginationMetaDataService.getMetaData("UsersEntity");
    }

    public List<UsersEntity> getAllAccounts() {
        return usersRepository.findAll();
    }

    @Transactional
    public void deleteAccount(String email) {
        UsersEntity user = usersRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with email: " + email));

        try {
            recombee.deleteUser(user.getId());
        } catch (Exception e) {
            // Log but don't fail
        }

        usersRepository.deleteById(user.getId());
        paginationMetaDataService.decrementStatus("UsersEntity", user.getStatus());
    }

    @Transactional
    public void upgradeToAdmin(String email){
        UsersEntity user = usersRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with email: " + email));
        if (user.getRole() == RoleEnum.ADMIN || user.getRole() == RoleEnum.SUPER_ADMIN) {
            throw new ConflictException("User with email " + email + " is already an Admin or Super Admin");
        }
        user.setRole(RoleEnum.ADMIN);
    }
}

package me.one_org.melody.Configuration;

import me.one_org.melody.Entity.UsersEntity;
import me.one_org.melody.Enums.RoleEnum;
import me.one_org.melody.Repository.UsersRepository;


import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DatabaseSeeder implements CommandLineRunner {
    private final  UsersRepository usersRepository;
    @Value("${spring.application.admin.id}")
    private String adminId;
    @Value("${spring.application.admin.name}")
    private String adminName;
    @Value("${spring.application.admin.email}")
    private String adminEmail;

    public DatabaseSeeder(UsersRepository usersRepository){
        this.usersRepository = usersRepository;
    }


    @Override
    public void run(String... args) throws Exception {
        if (adminId == null) {
            throw new Exception();
        };
        if (!usersRepository.existsById(adminId)) {
            UsersEntity admin = UsersEntity.builder()
                    .id(adminId)
                    .userName(adminName)
                    .email(adminEmail)
                    .role(RoleEnum.ADMIN)
                    .build();
            if (admin == null) {
                throw new Exception();
            };
            usersRepository.save(admin);
        };
    }
}

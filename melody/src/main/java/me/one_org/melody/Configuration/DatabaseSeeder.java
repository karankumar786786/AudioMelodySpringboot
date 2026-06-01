package me.one_org.melody.Configuration;

import me.one_org.melody.Entity.Users;
import me.one_org.melody.Enums.Role;
import me.one_org.melody.Repository.UsersRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DatabaseSeeder implements CommandLineRunner {
    @Autowired
    private  UsersRepository usersRepository;
    @Override
    public void run(String... args) throws Exception {
        if (!usersRepository.existsById("admin")) {
            Users admin = Users.builder()
                    .id("admin")
                    .userName("karan")
                    .email("ks1802276@melody.com")
                    .role(Role.ADMIN)
                    .build();
            usersRepository.save(admin);
        }
    }
}

package me.one_org.melody.Configuration;

import me.one_org.melody.Entity.Users;
import me.one_org.melody.Enums.Role;
import me.one_org.melody.Repository.UsersRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
public class DatabaseSeederTest {

    @Autowired
    private UsersRepository usersRepository;

    @Test
    public void testAdminUserSeeded() {
        Optional<Users> adminOpt = usersRepository.findById("admin");
        assertTrue(adminOpt.isPresent(), "Admin user should have been seeded on startup");
        
        Users admin = adminOpt.get();
        assertEquals("admin", admin.getId());
        assertEquals("karan", admin.getUserName());
        assertEquals("admin@melody.com", admin.getEmail());
        assertEquals(Role.ADMIN, admin.getRole());
    }
}

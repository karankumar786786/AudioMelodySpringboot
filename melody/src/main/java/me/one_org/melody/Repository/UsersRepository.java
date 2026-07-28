package me.one_org.melody.Repository;

import me.one_org.melody.Entity.Users;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UsersRepository extends JpaRepository<Users, String> {
    boolean existsByEmail(String email);
}

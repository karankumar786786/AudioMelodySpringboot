package me.one_org.melody.Repository;


import me.one_org.melody.Entity.UsersEntity;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UsersRepository extends JpaRepository<UsersEntity, String> {
    boolean existsByEmail(String email);
}

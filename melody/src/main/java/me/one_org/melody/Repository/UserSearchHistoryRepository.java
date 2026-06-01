package me.one_org.melody.Repository;

import me.one_org.melody.Entity.UserSearchHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserSearchHistoryRepository extends JpaRepository<UserSearchHistory, String> {
}

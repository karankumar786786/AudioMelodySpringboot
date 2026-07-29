package me.one_org.melody.Repository;

import me.one_org.melody.Entity.UserHistory;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserHistoryRepository extends JpaRepository<UserHistory, String> {
}

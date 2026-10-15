package me.one_org.melody.Repository;

import me.one_org.melody.Entity.User;
import me.one_org.melody.Entity.UserHistory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface UserHistoryRepository extends JpaRepository<UserHistory, String> {

    @Query("SELECT h FROM UserHistory h JOIN FETCH h.song WHERE h.user = :user ORDER BY h.listenedAt DESC")
    List<UserHistory> findByUserOrderByListenedAtDescQuery(@Param("user") User user, Pageable pageable);

    default List<UserHistory> findByUserOrderByListenedAtDesc(User user, int page, int size) {
        return findByUserOrderByListenedAtDescQuery(user, PageRequest.of(page, size));
    }

    @Query("SELECT h FROM UserHistory h JOIN FETCH h.song WHERE h.user = :user " +
           "AND h.listenedAt = (SELECT MAX(h2.listenedAt) FROM UserHistory h2 WHERE h2.user = :user AND h2.song = h.song) " +
           "ORDER BY h.listenedAt DESC")
    List<UserHistory> findRecentByUserQuery(@Param("user") User user, Pageable pageable);

    default List<UserHistory> findRecentByUser(User user, int limit) {
        return findRecentByUserQuery(user, PageRequest.of(0, limit));
    }

    long countByUser(User user);

    @Modifying
    @Transactional
    @Query("DELETE FROM UserHistory h WHERE h.user = :user")
    void deleteByUser(@Param("user") User user);
}

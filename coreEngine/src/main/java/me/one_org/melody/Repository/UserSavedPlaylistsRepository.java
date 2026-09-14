package me.one_org.melody.Repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
// import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import me.one_org.melody.Entity.UserPlaylistsEntity;
import me.one_org.melody.Entity.UserSavedPlaylistsEntity;
import me.one_org.melody.Entity.UsersEntity;

// @Repository
public interface UserSavedPlaylistsRepository extends JpaRepository<UserSavedPlaylistsEntity, String> {

    Optional<UserSavedPlaylistsEntity> findByUserAndPlaylist(UsersEntity user, UserPlaylistsEntity playlist);

    boolean existsByUserAndPlaylist(UsersEntity user, UserPlaylistsEntity playlist);

    @Query("SELECT usp.playlist FROM UserSavedPlaylistsEntity usp WHERE usp.user.id = :userId ORDER BY usp.savedAt DESC")
    List<UserPlaylistsEntity> findSavedPlaylistsByUserId(@Param("userId") String userId);

    void deleteByUserAndPlaylist(UsersEntity user, UserPlaylistsEntity playlist);

    @Modifying
    @Transactional
    @Query("DELETE FROM UserSavedPlaylistsEntity usp WHERE usp.playlist = :playlist")
    void deleteByPlaylist(@Param("playlist") UserPlaylistsEntity playlist);
}

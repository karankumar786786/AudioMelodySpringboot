package me.one_org.melody.Repository;

import me.one_org.melody.Entity.SongMetadata;
import org.springframework.data.jpa.repository.JpaRepository;


import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

public interface SongMetadataRepository extends JpaRepository<SongMetadata, String> {
    Optional<SongMetadata> findBySong_Id(String songId);

    @Modifying
    @Transactional
    @Query("UPDATE SongMetadata sm SET sm.totalStreams = COALESCE(sm.totalStreams, 0) + 1, sm.updatedAt = CURRENT_TIMESTAMP WHERE sm.song.id = :songId")
    int incrementStreams(@Param("songId") String songId);
}

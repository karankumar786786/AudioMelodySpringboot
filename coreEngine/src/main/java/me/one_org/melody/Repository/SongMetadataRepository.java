package me.one_org.melody.Repository;

import me.one_org.melody.Entity.SongMetadata;
import org.springframework.data.jpa.repository.JpaRepository;


import java.util.Optional;

public interface SongMetadataRepository extends JpaRepository<SongMetadata, String> {
    Optional<SongMetadata> findBySong_Id(String songId);
}

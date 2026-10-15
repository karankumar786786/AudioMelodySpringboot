package me.one_org.melody.Repository;

import me.one_org.melody.Entity.ArtistMetadata;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

public interface ArtistMetadataRepository extends JpaRepository<ArtistMetadata, String> {

    @Query("SELECT m FROM ArtistMetadata m WHERE m.id = :artistId")
    Optional<ArtistMetadata> findByArtistId(@Param("artistId") String artistId);

    @Query("SELECT m.followersCount FROM ArtistMetadata m WHERE m.id = :artistId")
    Optional<Long> findFollowersCountById(@Param("artistId") String artistId);

    @Modifying
    @Transactional
    @Query("UPDATE ArtistMetadata m SET m.followersCount = m.followersCount + 1, m.updatedAt = CURRENT_TIMESTAMP WHERE m.id = :artistId")
    int incrementFollowersCount(@Param("artistId") String artistId);

    @Modifying
    @Transactional
    @Query("UPDATE ArtistMetadata m SET m.followersCount = CASE WHEN m.followersCount > 0 THEN m.followersCount - 1 ELSE 0 END, m.updatedAt = CURRENT_TIMESTAMP WHERE m.id = :artistId")
    int decrementFollowersCount(@Param("artistId") String artistId);

    @Transactional
    default ArtistMetadata incrementFollowers(String artistId, String artistName) {
        Optional<ArtistMetadata> opt = findById(artistId);
        if (opt.isPresent()) {
            ArtistMetadata metadata = opt.get();
            metadata.setFollowersCount(metadata.getFollowersCount() + 1L);
            metadata.setUpdatedAt(LocalDateTime.now());
            return save(metadata);
        } else {
            ArtistMetadata metadata = ArtistMetadata.builder()
                    .id(artistId)
                    .followersCount(1L)
                    .createdAt(LocalDateTime.now())
                    .updatedAt(LocalDateTime.now())
                    .build();
            return save(metadata);
        }
    }

    @Transactional
    default ArtistMetadata decrementFollowers(String artistId) {
        Optional<ArtistMetadata> opt = findById(artistId);
        if (opt.isPresent()) {
            ArtistMetadata metadata = opt.get();
            long newCount = Math.max(0L, metadata.getFollowersCount() - 1L);
            metadata.setFollowersCount(newCount);
            metadata.setUpdatedAt(LocalDateTime.now());
            return save(metadata);
        }
        return null;
    }
}

package me.one_org.melody.Repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import me.one_org.melody.Entity.ArtistMetadataEntity;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Repository
public class ArtistMetadataRepository {

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional
    public void save(ArtistMetadataEntity metadata) {
        if (entityManager.find(ArtistMetadataEntity.class, metadata.getArtistId()) != null) {
            entityManager.merge(metadata);
        } else {
            entityManager.persist(metadata);
        }
    }

    public Optional<ArtistMetadataEntity> findById(String artistId) {
        return Optional.ofNullable(entityManager.find(ArtistMetadataEntity.class, artistId));
    }

    @Transactional
    public ArtistMetadataEntity incrementFollowers(String artistId, String artistName) {
        ArtistMetadataEntity metadata = entityManager.find(ArtistMetadataEntity.class, artistId);
        if (metadata == null) {
            metadata = ArtistMetadataEntity.builder()
                    .artistId(artistId)
                    .artistName(artistName != null ? artistName : "")
                    .followersCount(1L)
                    .build();
            entityManager.persist(metadata);
        } else {
            metadata.setFollowersCount(metadata.getFollowersCount() + 1L);
            if (artistName != null && !artistName.isBlank()) {
                metadata.setArtistName(artistName);
            }
            metadata = entityManager.merge(metadata);
        }
        return metadata;
    }

    @Transactional
    public ArtistMetadataEntity decrementFollowers(String artistId) {
        ArtistMetadataEntity metadata = entityManager.find(ArtistMetadataEntity.class, artistId);
        if (metadata != null) {
            long newCount = Math.max(0L, metadata.getFollowersCount() - 1L);
            metadata.setFollowersCount(newCount);
            metadata = entityManager.merge(metadata);
        }
        return metadata;
    }
}

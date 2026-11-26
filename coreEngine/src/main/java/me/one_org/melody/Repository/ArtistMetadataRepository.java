package me.one_org.melody.Repository;

import me.one_org.melody.Entity.ArtistMetadata;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Table artist_metadata ke liye queries - mainly followers ka count.
 *
 * Repository = database se baat karne wali layer. Spring Data JPA in interfaces ka code khud bana deta hai:
 * method ka naam (findByEmail) ya @Query likho, SQL Spring chala dega.
 * @EntityGraph = related data (jaise songMetadata) ek hi query me saath laao, alag query (N+1 problem) se bacho.
 * @Modifying = ye query data badalti hai (UPDATE/DELETE), sirf padhti nahi.
 */
public interface ArtistMetadataRepository extends JpaRepository<ArtistMetadata, String> {

    /** Artist id se uska metadata. */
    @Query("SELECT m FROM ArtistMetadata m WHERE m.id = :artistId")
    Optional<ArtistMetadata> findByArtistId(@Param("artistId") String artistId);

    /** Sirf followers ka count (poori row nahi). */
    @Query("SELECT m.followersCount FROM ArtistMetadata m WHERE m.id = :artistId")
    Optional<Long> findFollowersCountById(@Param("artistId") String artistId);

    /** Followers +1, seedha database me (ek hi UPDATE, isliye do requests saath aayein to bhi count sahi rehta hai). */
    @Modifying
    @Transactional
    @Query("UPDATE ArtistMetadata m SET m.followersCount = m.followersCount + 1, m.updatedAt = CURRENT_TIMESTAMP WHERE m.id = :artistId")
    int incrementFollowersCount(@Param("artistId") String artistId);

    /** Followers -1, par kabhi 0 se neeche nahi. */
    @Modifying
    @Transactional
    @Query("UPDATE ArtistMetadata m SET m.followersCount = CASE WHEN m.followersCount > 0 THEN m.followersCount - 1 ELSE 0 END, m.updatedAt = CURRENT_TIMESTAMP WHERE m.id = :artistId")
    int decrementFollowersCount(@Param("artistId") String artistId);

    /**
     * Followers +1, aur agar metadata row hai hi nahi to 1 count ke saath nayi row banao.
     * Artist ka naam khaali ho to wo bhi bhar dete hain.
     */
    @Transactional
    default ArtistMetadata incrementFollowers(String artistId, String artistName) {
        Optional<ArtistMetadata> opt = findById(artistId);
        if (opt.isPresent()) {
            ArtistMetadata metadata = opt.get();
            metadata.setFollowersCount(metadata.getFollowersCount() + 1L);
            if ((metadata.getArtistName() == null || metadata.getArtistName().isBlank()) && artistName != null) {
                metadata.setArtistName(artistName);
            }
            metadata.setUpdatedAt(LocalDateTime.now());
            return save(metadata);
        } else {
            ArtistMetadata metadata = ArtistMetadata.builder()
                    .id(artistId)
                    .artistName(artistName != null && !artistName.isBlank() ? artistName : "Unknown Artist")
                    .followersCount(1L)
                    .createdAt(LocalDateTime.now())
                    .updatedAt(LocalDateTime.now())
                    .build();
            return save(metadata);
        }
    }

    /** Followers -1 (0 se neeche nahi). Row hi nahi hai to null. */
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

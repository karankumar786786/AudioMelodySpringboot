package me.one_org.melody.Repository;

import me.one_org.melody.Entity.SongMetadata;
import org.springframework.data.jpa.repository.JpaRepository;


import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Table song_metadata ke liye queries (song ke streams ka count).
 *
 * Repository = database se baat karne wali layer. Spring Data JPA in interfaces ka code khud bana deta hai:
 * method ka naam (findByEmail) ya @Query likho, SQL Spring chala dega.
 * @EntityGraph = related data (jaise songMetadata) ek hi query me saath laao, alag query (N+1 problem) se bacho.
 * @Modifying = ye query data badalti hai (UPDATE/DELETE), sirf padhti nahi.
 */
public interface SongMetadataRepository extends JpaRepository<SongMetadata, String> {
    /** Song id se uska metadata. */
    Optional<SongMetadata> findBySong_Id(String songId);

    /** Streams +1 (null ho to 0 maan ke). Ek hi UPDATE query, isliye race condition nahi. */
    @Modifying
    @Transactional
    @Query("UPDATE SongMetadata sm SET sm.totalStreams = COALESCE(sm.totalStreams, 0) + 1, sm.updatedAt = CURRENT_TIMESTAMP WHERE sm.song.id = :songId")
    int incrementStreams(@Param("songId") String songId);
}

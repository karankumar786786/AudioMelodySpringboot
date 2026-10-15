package me.one_org.melody.Integration;

import java.util.Optional;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import me.one_org.melody.Entity.Song;
import me.one_org.melody.Entity.SongMetadata;
import me.one_org.melody.Enums.StatusEnum;
import me.one_org.melody.Repository.SongMetadataRepository;
import me.one_org.melody.Repository.SongsRepository;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class SongMetadataRepositoryIntegrationTest {

    @Autowired
    private SongMetadataRepository songMetadataRepository;

    @Autowired
    private SongsRepository songsRepository;

    @PersistenceContext
    private EntityManager entityManager;

    @Test
    @DisplayName("Should atomically increment totalStreams in database")
    void shouldAtomicallyIncrementStreams() {
        Song song = Song.builder()
                .id("song-int-1")
                .title("Stairway to Heaven")
                .artistName("Led Zeppelin")
                .duration(482)
                .songKey("s3/stairway.mp3")
                .imageKey("s3/cover.jpg")
                .isFeatured(true)
                .language("English")
                .genre("Rock")
                .album("Led Zeppelin IV")
                .lrclibId("lrc-100")
                .status(StatusEnum.ACTIVE)
                .build();
        songsRepository.saveAndFlush(song);

        SongMetadata metadata = SongMetadata.builder()
                .id("meta-int-1")
                .song(song)
                .totalStreams(10L)
                .build();
        songMetadataRepository.saveAndFlush(metadata);
        entityManager.clear();

        int rows = songMetadataRepository.incrementStreams("song-int-1");
        assertThat(rows).isEqualTo(1);

        entityManager.clear();

        Optional<SongMetadata> updated = songMetadataRepository.findBySong_Id("song-int-1");
        assertThat(updated).isPresent();
        assertThat(updated.get().getTotalStreams()).isEqualTo(11L);
    }
}

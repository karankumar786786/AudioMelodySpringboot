package me.one_org.melody.Integration;

import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;

import me.one_org.melody.Entity.Song;
import me.one_org.melody.Entity.SongMetadata;
import me.one_org.melody.Enums.StatusEnum;
import me.one_org.melody.Repository.SongMetadataRepository;
import me.one_org.melody.Repository.SongsRepository;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
class SongMetadataRepositoryIntegrationTest {

    @Autowired
    private SongMetadataRepository songMetadataRepository;

    @Autowired
    private SongsRepository songsRepository;

    @Autowired
    private TestEntityManager entityManager;

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
        entityManager.persistAndFlush(song);

        SongMetadata metadata = SongMetadata.builder()
                .id("meta-int-1")
                .song(song)
                .totalStreams(10L)
                .build();
        entityManager.persistAndFlush(metadata);
        entityManager.clear();

        int rows = songMetadataRepository.incrementStreams("song-int-1");
        assertThat(rows).isEqualTo(1);

        entityManager.clear();

        Optional<SongMetadata> updated = songMetadataRepository.findBySong_Id("song-int-1");
        assertThat(updated).isPresent();
        assertThat(updated.get().getTotalStreams()).isEqualTo(11L);
    }
}

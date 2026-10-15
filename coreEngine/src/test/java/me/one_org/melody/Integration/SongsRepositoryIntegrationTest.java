package me.one_org.melody.Integration;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;

import me.one_org.melody.Entity.Song;
import me.one_org.melody.Entity.SongMetadata;
import me.one_org.melody.Enums.StatusEnum;
import me.one_org.melody.Repository.SongsRepository;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
class SongsRepositoryIntegrationTest {

    @Autowired
    private SongsRepository songsRepository;

    @Autowired
    private TestEntityManager entityManager;

    @Test
    @DisplayName("Should fetch song along with its songMetadata via EntityGraph")
    void shouldFetchSongWithMetadata() {
        Song song = Song.builder()
                .id("song-graph-1")
                .title("Hotel California")
                .artistName("Eagles")
                .duration(391)
                .songKey("s3/hotel.mp3")
                .imageKey("s3/eagles.jpg")
                .isFeatured(false)
                .language("English")
                .genre("Rock")
                .album("Hotel California")
                .lrclibId("lrc-200")
                .status(StatusEnum.ACTIVE)
                .build();
        entityManager.persistAndFlush(song);

        SongMetadata metadata = SongMetadata.builder()
                .id("meta-graph-1")
                .song(song)
                .totalStreams(9500L)
                .build();
        entityManager.persistAndFlush(metadata);
        entityManager.clear();

        Optional<Song> result = songsRepository.findById("song-graph-1");
        assertThat(result).isPresent();
        assertThat(result.get().getTitle()).isEqualTo("Hotel California");
        assertThat(result.get().getSongMetadata()).isNotNull();
        assertThat(result.get().getSongMetadata().getTotalStreams()).isEqualTo(9500L);
    }

    @Test
    @DisplayName("Should query active songs paginated")
    void shouldFindActiveSongs() {
        Song activeSong = Song.builder()
                .id("active-1")
                .title("Active Song")
                .artistName("Active Artist")
                .duration(180)
                .songKey("s3/act.mp3")
                .imageKey("s3/act.jpg")
                .isFeatured(false)
                .language("Spanish")
                .genre("Latin")
                .album("Latin Hits")
                .lrclibId("lrc-300")
                .status(StatusEnum.ACTIVE)
                .build();

        Song disabledSong = Song.builder()
                .id("disabled-1")
                .title("Disabled Song")
                .artistName("Disabled Artist")
                .duration(150)
                .songKey("s3/dis.mp3")
                .imageKey("s3/dis.jpg")
                .isFeatured(false)
                .language("Spanish")
                .genre("Latin")
                .album("Old Hits")
                .lrclibId("lrc-301")
                .status(StatusEnum.DISABLE)
                .build();

        entityManager.persistAndFlush(activeSong);
        entityManager.persistAndFlush(disabledSong);
        entityManager.clear();

        List<Song> activeList = songsRepository.findActiveSongs(PageRequest.of(0, 10));
        assertThat(activeList).hasSize(1);
        assertThat(activeList.get(0).getId()).isEqualTo("active-1");
    }
}

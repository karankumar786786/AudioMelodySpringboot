package me.one_org.melody.Integration;

import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.ActiveProfiles;

import me.one_org.melody.AlgoliaSearch.AlgoliaSearch;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Entity.SongMetadata;
import me.one_org.melody.Entity.User;
import me.one_org.melody.Enums.StatusEnum;
import me.one_org.melody.Events.TelemetryEventListener;
import me.one_org.melody.Recommendation.Recombee;
import me.one_org.melody.Repository.SongMetadataRepository;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Repository.UserHistoryRepository;
import me.one_org.melody.Repository.UsersRepository;
import me.one_org.melody.Services.Api.InteractionApiService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;

@SpringBootTest
@ActiveProfiles("test")
class SongTelemetryFlowE2ETest {

    @Autowired
    private InteractionApiService interactionApiService;

    @Autowired
    private TelemetryEventListener telemetryEventListener;

    @Autowired
    private SongsRepository songsRepository;

    @Autowired
    private UsersRepository usersRepository;

    @Autowired
    private SongMetadataRepository songMetadataRepository;

    @Autowired
    private UserHistoryRepository userHistoryRepository;

    @MockitoBean
    private AlgoliaSearch algoliaSearch;

    @MockitoBean
    private Recombee recombee;

    @AfterEach
    void tearDown() {
        userHistoryRepository.deleteAll();
        songMetadataRepository.deleteAll();
        songsRepository.deleteAll();
        usersRepository.deleteAll();
    }

    @Test
    @DisplayName("E2E: Complete song play lifecycle updates DB totalStreams, Algolia, and Recombee")
    void shouldExecuteFullSongPlayPipeline() throws Exception {
        // 1. Seed user and song in database
        User user = User.builder()
                .id("e2e-user-1")
                .userName("Alex")
                .email("alex@example.com")
                .status(StatusEnum.ACTIVE)
                .build();
        usersRepository.saveAndFlush(user);

        Song song = Song.builder()
                .id("e2e-song-1")
                .title("Comfortably Numb")
                .artistName("Pink Floyd")
                .duration(382)
                .songKey("s3/numb.mp3")
                .imageKey("s3/numb.jpg")
                .isFeatured(true)
                .language("English")
                .genre("Rock")
                .album("The Wall")
                .lrclibId("lrc-wall-1")
                .status(StatusEnum.ACTIVE)
                .build();
        songsRepository.saveAndFlush(song);

        SongMetadata metadata = SongMetadata.builder()
                .id("e2e-meta-1")
                .song(song)
                .totalStreams(100L)
                .build();
        songMetadataRepository.saveAndFlush(metadata);

        // 2. User plays the song with 95% completion (triggers event publish)
        interactionApiService.trackPlay("e2e-user-1", "e2e-song-1", 0.95);

        // 3. Await async telemetry event listener processing
        long deadline = System.currentTimeMillis() + 4000;
        Optional<SongMetadata> updatedMetadata = Optional.empty();
        while (System.currentTimeMillis() < deadline) {
            updatedMetadata = songMetadataRepository.findBySong_Id("e2e-song-1");
            if (updatedMetadata.isPresent() && updatedMetadata.get().getTotalStreams() != null
                    && updatedMetadata.get().getTotalStreams() == 101L) {
                break;
            }
            Thread.sleep(50);
        }

        // 4. Assert PostgreSQL streams incremented to 101
        assertThat(updatedMetadata).isPresent();
        assertThat(updatedMetadata.get().getTotalStreams()).isEqualTo(101L);

        // 5. Assert Algolia received atomic totalStreams increment
        verify(algoliaSearch, timeout(4000)).incrementTotalStreams("e2e-song-1");

        // 6. Assert Recombee received strong positive rating and updated totalStreams
        verify(recombee, timeout(4000)).trackPlay("e2e-user-1", "e2e-song-1", 0.95);
        verify(recombee, timeout(4000)).updateTotalStreams("e2e-song-1", 101L);
    }
}

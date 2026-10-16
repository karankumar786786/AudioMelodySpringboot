package me.one_org.melody.AlgoliaSearch;

import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import com.algolia.api.SearchClient;
import com.algolia.model.search.IndexSettings;

import me.one_org.melody.Dto.AlgoliaSearch.AlgoliaClientConfigDto;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Entity.SongMetadata;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AlgoliaSearchTest {

    @Mock
    private SearchClient searchClient;

    @InjectMocks
    private AlgoliaSearch algoliaSearch;

    private static final String INDEX_NAME = "test_melody_songs";
    private static final String APP_ID = "test_app_id";
    private static final String API_KEY = "test_admin_key";
    private static final String SEARCH_API_KEY = "test_search_only_key";

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(algoliaSearch, "indexName", INDEX_NAME);
        ReflectionTestUtils.setField(algoliaSearch, "appId", APP_ID);
        ReflectionTestUtils.setField(algoliaSearch, "apiKey", API_KEY);
        ReflectionTestUtils.setField(algoliaSearch, "searchApiKey", SEARCH_API_KEY);
    }

    @Test
    @DisplayName("Should configure Algolia index with customRanking desc(totalStreams) and desc(searchCount)")
    void shouldConfigureIndexCorrectly() throws Exception {
        algoliaSearch.configureIndex();

        ArgumentCaptor<IndexSettings> settingsCaptor = ArgumentCaptor.forClass(IndexSettings.class);
        verify(searchClient).setSettings(eq(INDEX_NAME), settingsCaptor.capture());

        IndexSettings settings = settingsCaptor.getValue();
        assertThat(settings.getCustomRanking()).containsExactly("desc(totalStreams)", "desc(searchCount)");
        assertThat(settings.getSearchableAttributes()).contains("title", "artistName", "album");
    }

    @Test
    @DisplayName("Should increment searchCount atomically using partialUpdateObject")
    void shouldIncrementSearchCount() {
        algoliaSearch.incrementSearchCount("artist-queen");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> updateCaptor = ArgumentCaptor.forClass(Map.class);
        verify(searchClient).partialUpdateObject(eq(INDEX_NAME), eq("artist-queen"), updateCaptor.capture(), eq(true));

        Map<String, Object> update = updateCaptor.getValue();
        assertThat(update).containsKey("searchCount");
        @SuppressWarnings("unchecked")
        Map<String, Object> op = (Map<String, Object>) update.get("searchCount");
        assertThat(op.get("_operation")).isEqualTo("Increment");
        assertThat(op.get("value")).isEqualTo(1);
    }

    @Test
    @DisplayName("Should increment totalStreams atomically using partialUpdateObject")
    void shouldIncrementTotalStreams() {
        algoliaSearch.incrementTotalStreams("song-123");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> updateCaptor = ArgumentCaptor.forClass(Map.class);
        verify(searchClient).partialUpdateObject(eq(INDEX_NAME), eq("song-123"), updateCaptor.capture(), eq(true));

        Map<String, Object> update = updateCaptor.getValue();
        assertThat(update).containsKey("totalStreams");
        @SuppressWarnings("unchecked")
        Map<String, Object> op = (Map<String, Object>) update.get("totalStreams");
        assertThat(op.get("_operation")).isEqualTo("Increment");
        assertThat(op.get("value")).isEqualTo(1);
    }

    @Test
    @DisplayName("Should save Song record into Algolia including totalStreams")
    void shouldSaveSongRecordWithTotalStreams() throws Exception {
        SongMetadata metadata = SongMetadata.builder()
                .id("meta-1")
                .totalStreams(450L)
                .build();

        Song song = Song.builder()
                .id("song-1")
                .title("Bohemian Rhapsody")
                .artistName("Queen")
                .album("A Night at the Opera")
                .language("English")
                .genre("Rock")
                .duration(354)
                .songMetadata(metadata)
                .build();

        algoliaSearch.save(song);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> recordCaptor = ArgumentCaptor.forClass(Map.class);
        verify(searchClient).saveObject(eq(INDEX_NAME), recordCaptor.capture());

        Map<String, Object> record = recordCaptor.getValue();
        assertThat(record.get("objectID")).isEqualTo("song-1");
        assertThat(record.get("title")).isEqualTo("Bohemian Rhapsody");
        assertThat(record.get("totalStreams")).isEqualTo(450L);
        assertThat(record.get("searchCount")).isEqualTo(0L);
    }

    @Test
    @DisplayName("Should return configured searchApiKey in getClientSearchConfig")
    void shouldReturnFrontendConfig() {
        AlgoliaClientConfigDto config = algoliaSearch.getClientSearchConfig();

        assertThat(config.appId()).isEqualTo(APP_ID);
        assertThat(config.indexName()).isEqualTo(INDEX_NAME);
        assertThat(config.apiKey()).isEqualTo(SEARCH_API_KEY);
    }
}

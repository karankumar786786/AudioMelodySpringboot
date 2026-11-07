package me.one_org.melody.Recommendation;

import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Enums.StatusEnum;

import static org.assertj.core.api.Assertions.assertThat;

class RecommendationRankingEngineTest {

    private RecommendationRankingEngine engine;

    @BeforeEach
    void setUp() {
        engine = new RecommendationRankingEngine();
    }

    private SongDto buildSongDto(String id, String title, String artist, String genre, String album, String language, Long streams) {
        return new SongDto(
                id, title, artist, 200, "key/" + id, "img/" + id,
                null, null, null, null, false, language, genre, album,
                "lrc", StatusEnum.ACTIVE, streams, null
        );
    }

    private Song buildSongEntity(String id, String title, String artist, String genre, String album, String language) {
        return Song.builder()
                .id(id)
                .title(title)
                .artistName(artist)
                .genre(genre)
                .album(album)
                .language(language)
                .status(StatusEnum.ACTIVE)
                .build();
    }

    @Test
    @DisplayName("Should strictly enforce max tracks per artist to prevent single artist monopoly")
    void shouldStrictlyEnforceMaxTracksPerArtist() {
        Song seed = buildSongEntity("seed-1", "Seed Romantic", "Arijit Singh", "Romantic", "Album 1", "Hindi");

        // 4 songs by Arijit Singh
        List<SongDto> candidates = new ArrayList<>();
        candidates.add(buildSongDto("s-1", "Song 1", "Arijit Singh", "Romantic", "Album A", "Hindi", 1000L));
        candidates.add(buildSongDto("s-2", "Song 2", "Arijit Singh", "Romantic", "Album B", "Hindi", 800L));
        candidates.add(buildSongDto("s-3", "Song 3", "Arijit Singh", "Romantic", "Album C", "Hindi", 600L));
        candidates.add(buildSongDto("s-4", "Song 4", "Arijit Singh", "Romantic", "Album D", "Hindi", 400L));

        // 3 songs by different artists in the same genre
        candidates.add(buildSongDto("s-5", "Song 5", "Atif Aslam", "Romantic", "Album E", "Hindi", 900L));
        candidates.add(buildSongDto("s-6", "Song 6", "Mohit Chauhan", "Romantic", "Album F", "Hindi", 700L));
        candidates.add(buildSongDto("s-7", "Song 7", "Shreya Ghoshal", "Romantic", "Album G", "Hindi", 850L));

        List<SongDto> results = engine.rankAndDiversify(
                seed,
                candidates,
                List.of(),
                Set.of("seed-1"),
                5,
                2, // max 2 per artist
                2  // max 2 per album
        );

        assertThat(results).hasSize(5);

        // Verify Arijit Singh has at most 2 tracks in the top 5
        long arijitCount = results.stream().filter(s -> s.artistName().contains("Arijit")).count();
        assertThat(arijitCount).isLessThanOrEqualTo(2);

        // Verify other artists are included in the results
        List<String> artists = results.stream().map(SongDto::artistName).toList();
        assertThat(artists).contains("Atif Aslam");
        assertThat(artists).contains("Shreya Ghoshal");
    }

    @Test
    @DisplayName("Should strictly enforce max tracks per album to prevent album takeover")
    void shouldStrictlyEnforceMaxTracksPerAlbum() {
        Song seed = buildSongEntity("seed-1", "Soundtrack Title", "Singer A", "Bollywood", "Mega Movie OST", "Hindi");

        List<SongDto> candidates = new ArrayList<>();
        // 4 songs from the same movie soundtrack
        candidates.add(buildSongDto("s-1", "Track 1", "Singer A", "Bollywood", "Mega Movie OST", "Hindi", 500L));
        candidates.add(buildSongDto("s-2", "Track 2", "Singer B", "Bollywood", "Mega Movie OST", "Hindi", 400L));
        candidates.add(buildSongDto("s-3", "Track 3", "Singer C", "Bollywood", "Mega Movie OST", "Hindi", 300L));
        candidates.add(buildSongDto("s-4", "Track 4", "Singer D", "Bollywood", "Mega Movie OST", "Hindi", 200L));

        // Songs from different albums
        candidates.add(buildSongDto("s-5", "Track 5", "Singer E", "Bollywood", "Other Movie", "Hindi", 600L));
        candidates.add(buildSongDto("s-6", "Track 6", "Singer F", "Bollywood", "Another Movie", "Hindi", 700L));

        List<SongDto> results = engine.rankAndDiversify(
                seed,
                candidates,
                List.of(),
                Set.of("seed-1"),
                4,
                2, // max 2 per artist
                2  // max 2 per album
        );

        assertThat(results).hasSize(4);

        long sameAlbumCount = results.stream().filter(s -> "Mega Movie OST".equalsIgnoreCase(s.album())).count();
        assertThat(sameAlbumCount).isLessThanOrEqualTo(2);
    }

    @Test
    @DisplayName("Should score higher for matching genre and language than unrelated artist")
    void shouldScoreHigherForGenreAndLanguageThanUnrelated() {
        Song seed = buildSongEntity("seed-1", "Seed", "Artist X", "Acoustic Pop", "Album 1", "English");

        SongDto matchingVibe = buildSongDto("vibe-1", "Matching Song", "Different Artist", "Acoustic Pop", "Album 2", "English", 500L);
        SongDto sameArtistWrongVibe = buildSongDto("wrong-1", "Heavy Metal", "Artist X", "Heavy Metal", "Album 3", "German", 500L);

        double scoreVibe = engine.scoreCandidate(matchingVibe, seed, null);
        double scoreSameArtist = engine.scoreCandidate(sameArtistWrongVibe, seed, null);

        // Vibe match (genre 40 + lang 20) must beat same artist wrong vibe (artist 15)
        assertThat(scoreVibe).isGreaterThan(scoreSameArtist);
    }

    @Test
    @DisplayName("Should relax quotas if candidate pool is too small to fill target count")
    void shouldRelaxQuotasIfPoolIsSmall() {
        Song seed = buildSongEntity("seed-1", "Seed", "Solo Artist", "Pop", "Album", "English");

        // Only 3 songs exist, all by the same artist
        List<SongDto> candidates = List.of(
                buildSongDto("s-1", "Song 1", "Solo Artist", "Pop", "Album A", "English", 100L),
                buildSongDto("s-2", "Song 2", "Solo Artist", "Pop", "Album B", "English", 80L),
                buildSongDto("s-3", "Song 3", "Solo Artist", "Pop", "Album C", "English", 60L)
        );

        List<SongDto> results = engine.rankAndDiversify(
                seed,
                candidates,
                List.of(),
                Set.of("seed-1"),
                3,
                2, // max 2 per artist strictly
                2
        );

        // In fallback pass, relaxes quota so user still gets 3 songs rather than 2
        assertThat(results).hasSize(3);
    }

    @Test
    @DisplayName("Should score high for comma-separated multi-genre overlap regardless of order")
    void shouldScoreHighForCommaSeparatedMultiGenreOverlap() {
        Song seed = buildSongEntity("seed-1", "Seed", "Artist Seed", "Pop, Dance, Electronic", "Album A", "English");

        // Exact match with different order and whitespace
        SongDto exactDifferentOrder = buildSongDto("c-1", "Dance All Night", "Artist B", "Electronic,  Pop, Dance", "Album B", "English", 500L);
        // Partial overlap: shares "Pop" and "Dance"
        SongDto partialOverlap = buildSongDto("c-2", "Club Party", "Artist C", "Dance, Pop, House", "Album C", "English", 500L);
        // Single shared genre: shares "Pop"
        SongDto singleOverlap = buildSongDto("c-3", "Acoustic Pop", "Artist D", "Pop", "Album D", "English", 500L);
        // Subgenre substring overlap: "dance-pop" contains "dance" and "pop"
        SongDto subgenreOverlap = buildSongDto("c-4", "Synth Anthem", "Artist E", "Synth-Pop", "Album E", "English", 500L);
        // Zero overlap
        SongDto unrelatedGenre = buildSongDto("c-5", "Dark Metal", "Artist F", "Black Metal", "Album F", "English", 500L);

        double scoreExact = engine.scoreCandidate(exactDifferentOrder, seed, null);
        double scorePartial = engine.scoreCandidate(partialOverlap, seed, null);
        double scoreSingle = engine.scoreCandidate(singleOverlap, seed, null);
        double scoreSubgenre = engine.scoreCandidate(subgenreOverlap, seed, null);
        double scoreUnrelated = engine.scoreCandidate(unrelatedGenre, seed, null);

        // Lang is 20 + streams boost for all, so compare relative genre contributions
        assertThat(scoreExact).isGreaterThan(scorePartial);
        assertThat(scorePartial).isGreaterThan(scoreSingle);
        assertThat(scoreSingle).isGreaterThan(scoreSubgenre);
        assertThat(scoreSubgenre).isGreaterThan(scoreUnrelated);

        // Exact match of all comma-separated genres should achieve max 40 genre points (total score = 40 genre + 20 lang + stream boost)
        assertThat(scoreExact).isGreaterThanOrEqualTo(60.0);
    }

    @Test
    @DisplayName("Should parse genre set cleanly trimming whitespace and dropping empties")
    void shouldParseGenreSetCleanly() {
        Set<String> set = RecommendationRankingEngine.parseGenreSet(" Pop , Dance,  , Electronic , Pop  ");
        assertThat(set).containsExactlyInAnyOrder("pop", "dance", "electronic");
    }
}


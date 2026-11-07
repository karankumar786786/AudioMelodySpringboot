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
                null, null, null, null, false, language, genre, album, "India",
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

    @Test
    @DisplayName("Should score high for multi-artist matches and collaborator overlap")
    void shouldScoreHighForMultiArtistMatches() {
        Song seed = buildSongEntity("seed-1", "Rich Flex", "Drake, 21 Savage", "Hip Hop", "Her Loss", "English");

        // Exact match with different order: "21 Savage, Drake"
        SongDto reversedOrder = buildSongDto("c-1", "Spin Bout U", "21 Savage, Drake", "Hip Hop", "Album A", "English", 500L);
        // Primary artist match: "Drake, Travis Scott"
        SongDto primaryMatch = buildSongDto("c-2", "Meltdown", "Drake, Travis Scott", "Hip Hop", "Album B", "English", 500L);
        // Collaborator match: "Future, 21 Savage"
        SongDto collabMatch = buildSongDto("c-3", "Superhero", "Future, 21 Savage", "Hip Hop", "Album C", "English", 500L);
        // Zero overlap
        SongDto unrelatedArtist = buildSongDto("c-4", "Starboy", "The Weeknd", "Hip Hop", "Album D", "English", 500L);

        double scoreReversed = engine.scoreCandidate(reversedOrder, seed, null);
        double scorePrimary = engine.scoreCandidate(primaryMatch, seed, null);
        double scoreCollab = engine.scoreCandidate(collabMatch, seed, null);
        double scoreUnrelated = engine.scoreCandidate(unrelatedArtist, seed, null);

        // Reversed full duo match and primary match both earn maximum artist affinity (15 pts artist)
        // Allow small tolerance for deterministic playback jitter (0-3 pts)
        assertThat(scoreReversed).isCloseTo(scorePrimary, org.assertj.core.data.Offset.offset(3.5));
        // Shared collaborator (10 pts artist) should be higher than unrelated (0 pts artist)
        assertThat(scoreCollab).isGreaterThan(scoreUnrelated);
        // Full duo/primary match (15 pts) should beat shared collaborator (10 pts)
        assertThat(scorePrimary).isGreaterThan(scoreCollab);
    }

    @Test
    @DisplayName("Should enforce max tracks per artist across all comma-separated collaborators")
    void shouldEnforceMaxTracksAcrossAllCommaSeparatedArtists() {
        Song seed = buildSongEntity("seed-1", "Seed", "Seed Singer", "Pop", "Album", "English");

        // Drake appears as primary or collaborator across 4 songs
        List<SongDto> candidates = new ArrayList<>();
        candidates.add(buildSongDto("s-1", "Track 1", "Drake, 21 Savage", "Pop", "Album 1", "English", 1000L));
        candidates.add(buildSongDto("s-2", "Track 2", "Drake, Travis Scott", "Pop", "Album 2", "English", 900L));
        candidates.add(buildSongDto("s-3", "Track 3", "Future, Drake", "Pop", "Album 3", "English", 800L));
        candidates.add(buildSongDto("s-4", "Track 4", "Drake", "Pop", "Album 4", "English", 700L));

        // Other artists
        candidates.add(buildSongDto("s-5", "Track 5", "Post Malone", "Pop", "Album 5", "English", 600L));
        candidates.add(buildSongDto("s-6", "Track 6", "The Weeknd", "Pop", "Album 6", "English", 500L));

        List<SongDto> results = engine.rankAndDiversify(
                seed,
                candidates,
                List.of(),
                Set.of("seed-1"),
                4,
                2, // max 2 per artist
                2
        );

        assertThat(results).hasSize(4);
        long drakeCount = results.stream().filter(s -> s.artistName().toLowerCase().contains("drake")).count();
        assertThat(drakeCount).isLessThanOrEqualTo(2);
    }

    @Test
    @DisplayName("Should parse artist set cleanly with comma, slash, ampersand, and feat delimiters")
    void shouldParseArtistSetCleanly() {
        Set<String> set = RecommendationRankingEngine.parseArtistSet("Drake, 21 Savage / Metro Boomin & Future ft. Travis Scott feat. Lil Baby");
        assertThat(set).containsExactlyInAnyOrder("drake", "21 savage", "metro boomin", "future", "travis scott", "lil baby");
    }

    @Test
    @DisplayName("Should boost score for matching country")
    void shouldBoostScoreForMatchingCountry() {
        Song seed = Song.builder()
                .id("seed-1")
                .title("Seed")
                .artistName("Artist A")
                .genre("Pop")
                .album("Album A")
                .language("Hindi")
                .country("India")
                .status(StatusEnum.ACTIVE)
                .build();

        SongDto matchingCountry = new SongDto(
                "c-1", "Match", "Artist B", 200, "key/1", "img/1",
                null, null, null, null, false, "Hindi", "Pop", "Album B", "India",
                "lrc", StatusEnum.ACTIVE, 500L, null
        );

        SongDto differentCountry = new SongDto(
                "c-2", "Diff", "Artist B", 200, "key/2", "img/2",
                null, null, null, null, false, "Hindi", "Pop", "Album B", "USA",
                "lrc", StatusEnum.ACTIVE, 500L, null
        );

        double scoreMatch = engine.scoreCandidate(matchingCountry, seed, null);
        double scoreDiff = engine.scoreCandidate(differentCountry, seed, null);

        assertThat(scoreMatch).isGreaterThan(scoreDiff);
    }
}


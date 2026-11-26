package me.one_org.melody.Recommendation;

import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Enums.StatusEnum;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit test: RecommendationRankingEngine ko akele check karta hai (asli objects ke saath, bina database ke).
 * Har @Test method ek behaviour check karta hai - method ka naam batata hai kya.
 */
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

        // Arijit Singh ke 4 gaane
        List<SongDto> candidates = new ArrayList<>();
        candidates.add(buildSongDto("s-1", "Song 1", "Arijit Singh", "Romantic", "Album A", "Hindi", 1000L));
        candidates.add(buildSongDto("s-2", "Song 2", "Arijit Singh", "Romantic", "Album B", "Hindi", 800L));
        candidates.add(buildSongDto("s-3", "Song 3", "Arijit Singh", "Romantic", "Album C", "Hindi", 600L));
        candidates.add(buildSongDto("s-4", "Song 4", "Arijit Singh", "Romantic", "Album D", "Hindi", 400L));

        // Same genre me alag alag artists ke 3 gaane
        candidates.add(buildSongDto("s-5", "Song 5", "Atif Aslam", "Romantic", "Album E", "Hindi", 900L));
        candidates.add(buildSongDto("s-6", "Song 6", "Mohit Chauhan", "Romantic", "Album F", "Hindi", 700L));
        candidates.add(buildSongDto("s-7", "Song 7", "Shreya Ghoshal", "Romantic", "Album G", "Hindi", 850L));

        List<SongDto> results = engine.rankAndDiversify(
                seed,
                candidates,
                List.of(),
                Set.of("seed-1"),
                5,
                2, // ek artist ke max 2
                2  // ek album ke max 2
        );

        assertThat(results).hasSize(5);

        // Check: top 5 me Arijit Singh ke max 2 gaane
        long arijitCount = results.stream().filter(s -> s.artistName().contains("Arijit")).count();
        assertThat(arijitCount).isLessThanOrEqualTo(2);

        // Check: baaki artists bhi result me hain
        List<String> artists = results.stream().map(SongDto::artistName).toList();
        assertThat(artists).contains("Atif Aslam");
        assertThat(artists).contains("Shreya Ghoshal");
    }

    @Test
    @DisplayName("Should strictly enforce max tracks per album to prevent album takeover")
    void shouldStrictlyEnforceMaxTracksPerAlbum() {
        Song seed = buildSongEntity("seed-1", "Soundtrack Title", "Singer A", "Bollywood", "Mega Movie OST", "Hindi");

        List<SongDto> candidates = new ArrayList<>();
        // Ek hi movie soundtrack ke 4 gaane
        candidates.add(buildSongDto("s-1", "Track 1", "Singer A", "Bollywood", "Mega Movie OST", "Hindi", 500L));
        candidates.add(buildSongDto("s-2", "Track 2", "Singer B", "Bollywood", "Mega Movie OST", "Hindi", 400L));
        candidates.add(buildSongDto("s-3", "Track 3", "Singer C", "Bollywood", "Mega Movie OST", "Hindi", 300L));
        candidates.add(buildSongDto("s-4", "Track 4", "Singer D", "Bollywood", "Mega Movie OST", "Hindi", 200L));

        // Alag albums ke gaane
        candidates.add(buildSongDto("s-5", "Track 5", "Singer E", "Bollywood", "Other Movie", "Hindi", 600L));
        candidates.add(buildSongDto("s-6", "Track 6", "Singer F", "Bollywood", "Another Movie", "Hindi", 700L));

        List<SongDto> results = engine.rankAndDiversify(
                seed,
                candidates,
                List.of(),
                Set.of("seed-1"),
                4,
                2, // ek artist ke max 2
                2  // ek album ke max 2
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

        // Vibe match (genre 40 + language 20) ko same artist par galat vibe (artist 15) se jeetna chahiye
        assertThat(scoreVibe).isGreaterThan(scoreSameArtist);
    }

    @Test
    @DisplayName("Should relax quotas if candidate pool is too small to fill target count")
    void shouldRelaxQuotasIfPoolIsSmall() {
        Song seed = buildSongEntity("seed-1", "Seed", "Solo Artist", "Pop", "Album", "English");

        // Sirf 3 gaane hain, teeno ek hi artist ke
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
                2, // ek artist ke max 2, strictly
                2
        );

        // Fallback me limit dheeli hoti hai, to user ko 2 nahi, 3 gaane milte hain
        assertThat(results).hasSize(3);
    }

    @Test
    @DisplayName("Should score high for comma-separated multi-genre overlap regardless of order")
    void shouldScoreHighForCommaSeparatedMultiGenreOverlap() {
        Song seed = buildSongEntity("seed-1", "Seed", "Artist Seed", "Pop, Dance, Electronic", "Album A", "English");

        // Same genres, bas order aur spaces alag
        SongDto exactDifferentOrder = buildSongDto("c-1", "Dance All Night", "Artist B", "Electronic,  Pop, Dance", "Album B", "English", 500L);
        // Thoda common: "Pop" aur "Dance"
        SongDto partialOverlap = buildSongDto("c-2", "Club Party", "Artist C", "Dance, Pop, House", "Album C", "English", 500L);
        // Ek hi common genre: "Pop"
        SongDto singleOverlap = buildSongDto("c-3", "Acoustic Pop", "Artist D", "Pop", "Album D", "English", 500L);
        // Subgenre: "dance-pop" ke andar "dance" aur "pop" hain
        SongDto subgenreOverlap = buildSongDto("c-4", "Synth Anthem", "Artist E", "Synth-Pop", "Album E", "English", 500L);
        // Kuch bhi common nahi
        SongDto unrelatedGenre = buildSongDto("c-5", "Dark Metal", "Artist F", "Black Metal", "Album F", "English", 500L);

        double scoreExact = engine.scoreCandidate(exactDifferentOrder, seed, null);
        double scorePartial = engine.scoreCandidate(partialOverlap, seed, null);
        double scoreSingle = engine.scoreCandidate(singleOverlap, seed, null);
        double scoreSubgenre = engine.scoreCandidate(subgenreOverlap, seed, null);
        double scoreUnrelated = engine.scoreCandidate(unrelatedGenre, seed, null);

        // Language (20) + streams sabke same hain, to sirf genre ke points compare karo
        assertThat(scoreExact).isGreaterThan(scorePartial);
        assertThat(scorePartial).isGreaterThan(scoreSingle);
        assertThat(scoreSingle).isGreaterThan(scoreSubgenre);
        assertThat(scoreSubgenre).isGreaterThan(scoreUnrelated);

        // Saare genres match = poore 40 genre points (total = 40 genre + 20 language + streams)
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

        // Same artists, order alag: "21 Savage, Drake"
        SongDto reversedOrder = buildSongDto("c-1", "Spin Bout U", "21 Savage, Drake", "Hip Hop", "Album A", "English", 500L);
        // Main artist same: "Drake, Travis Scott"
        SongDto primaryMatch = buildSongDto("c-2", "Meltdown", "Drake, Travis Scott", "Hip Hop", "Album B", "English", 500L);
        // Saath wala artist same: "Future, 21 Savage"
        SongDto collabMatch = buildSongDto("c-3", "Superhero", "Future, 21 Savage", "Hip Hop", "Album C", "English", 500L);
        // Kuch bhi common nahi
        SongDto unrelatedArtist = buildSongDto("c-4", "Starboy", "The Weeknd", "Hip Hop", "Album D", "English", 500L);

        double scoreReversed = engine.scoreCandidate(reversedOrder, seed, null);
        double scorePrimary = engine.scoreCandidate(primaryMatch, seed, null);
        double scoreCollab = engine.scoreCandidate(collabMatch, seed, null);
        double scoreUnrelated = engine.scoreCandidate(unrelatedArtist, seed, null);

        // Ulta poora duo aur main artist match - dono ko poore 15 artist points
        // Random jitter (0-3 points) ke liye thodi chhoot
        assertThat(scoreReversed).isCloseTo(scorePrimary, org.assertj.core.data.Offset.offset(3.5));
        // Common saath wala artist (10) bina rishte wale (0) se upar
        assertThat(scoreCollab).isGreaterThan(scoreUnrelated);
        // Poora duo / main artist (15) common saath wale (10) se upar
        assertThat(scorePrimary).isGreaterThan(scoreCollab);
    }

    @Test
    @DisplayName("Should enforce max tracks per artist across all comma-separated collaborators")
    void shouldEnforceMaxTracksAcrossAllCommaSeparatedArtists() {
        Song seed = buildSongEntity("seed-1", "Seed", "Seed Singer", "Pop", "Album", "English");

        // Drake 4 gaano me main ya saath wala artist hai
        List<SongDto> candidates = new ArrayList<>();
        candidates.add(buildSongDto("s-1", "Track 1", "Drake, 21 Savage", "Pop", "Album 1", "English", 1000L));
        candidates.add(buildSongDto("s-2", "Track 2", "Drake, Travis Scott", "Pop", "Album 2", "English", 900L));
        candidates.add(buildSongDto("s-3", "Track 3", "Future, Drake", "Pop", "Album 3", "English", 800L));
        candidates.add(buildSongDto("s-4", "Track 4", "Drake", "Pop", "Album 4", "English", 700L));

        // Baaki artists
        candidates.add(buildSongDto("s-5", "Track 5", "Post Malone", "Pop", "Album 5", "English", 600L));
        candidates.add(buildSongDto("s-6", "Track 6", "The Weeknd", "Pop", "Album 6", "English", 500L));

        List<SongDto> results = engine.rankAndDiversify(
                seed,
                candidates,
                List.of(),
                Set.of("seed-1"),
                4,
                2, // ek artist ke max 2
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

    @Test
    @DisplayName("P5: Freshness random jitter varies between calls and stays within [0.0, 3.0]")
    void shouldProduceRandomJitterWithinBounds() {
        Song seed = buildSongEntity("seed-1", "Seed", "Artist A", "Pop", "Album A", "English");
        SongDto candidate = buildSongDto("c-1", "Cand", "Artist B", "Pop", "Album B", "English", 500L);

        // Kai baar score nikaalo - har baar thoda alag aana chahiye
        Set<Double> distinctScores = new HashSet<>();
        for (int i = 0; i < 20; i++) {
            double score = engine.scoreCandidate(candidate, seed, null);
            distinctScores.add(score);
        }
        // Random 0-3 ki wajah se 20 baar me kai alag scores aane chahiye
        assertThat(distinctScores.size()).isGreaterThan(1);
    }

    @Test
    @DisplayName("P7: Stream boost follows smooth log10 curve capped at 10.0")
    void shouldFollowSmoothLogStreamBoost() {
        SongDto zeroStreams = buildSongDto("c-0", "Z", "Artist B", "Pop", "A", "English", 0L);
        SongDto nullStreams = buildSongDto("c-null", "N", "Artist B", "Pop", "A", "English", null);
        SongDto streams100 = buildSongDto("c-100", "Mid", "Artist B", "Pop", "A", "English", 100L);
        SongDto streams1M = buildSongDto("c-1m", "High", "Artist B", "Pop", "A", "English", 1_000_000L);

        // Seed gaana null ho to score = Recombee rank ke points + streams ke points
        double scoreZero = engine.scoreCandidate(zeroStreams, null, null);
        double scoreNull = engine.scoreCandidate(nullStreams, null, null);
        assertThat(scoreZero).isEqualTo(0.0);
        assertThat(scoreNull).isEqualTo(0.0);

        double score100 = engine.scoreCandidate(streams100, null, null);
        double score1M = engine.scoreCandidate(streams1M, null, null);
        // Math.log10(101) * 1.6 ≈ 3.2
        assertThat(score100).isBetween(3.0, 3.5);
        // Math.log10(1000001) * 1.6 ≈ 9.6 <= 10.0
        assertThat(score1M).isBetween(9.0, 10.0);
    }

    @Test
    @DisplayName("P1: SongDto audio features are preserved and safely handled in scoring")
    void shouldPreserveAudioFeaturesInSongDto() {
        SongDto dtoWithAudio = new SongDto(
                "s-audio-1", "Audio Track", "Artist X", 210, "key/x", "img/x",
                null, null, null, null, false, "English", "Electronic", "Album X", "India",
                "lrc", StatusEnum.ACTIVE, "job-1", 1000L, null,
                128.0, 0.85, 0.65, 0.78
        );

        assertThat(dtoWithAudio.tempo()).isEqualTo(128.0);
        assertThat(dtoWithAudio.energy()).isEqualTo(0.85);
        assertThat(dtoWithAudio.valence()).isEqualTo(0.65);
        assertThat(dtoWithAudio.danceability()).isEqualTo(0.78);

        Song seed = buildSongEntity("seed-1", "Seed", "Artist X", "Electronic", "Album X", "English");
        double score = engine.scoreCandidate(dtoWithAudio, seed, null);
        assertThat(score).isGreaterThan(0.0);
    }

    private SongDto withAudio(String id, Double tempo, Double energy, Double valence, Double dance) {
        return buildSongDto(id, "T " + id, "Artist " + id, "Pop", null, "English", 0L)
                .withAudioFeatures(tempo, energy, valence, dance);
    }

    @Test
    @DisplayName("P1: Audio score rewards candidates that sound like the seed")
    void shouldScoreAudioSimilarityRelativeToSeed() {
        AudioProfile seed = new AudioProfile(120.0, 0.8, 0.6, 0.7);

        double identical = engine.scoreAudioFeatures(withAudio("a", 120.0, 0.8, 0.6, 0.7), seed);
        double close = engine.scoreAudioFeatures(withAudio("b", 125.0, 0.75, 0.55, 0.65), seed);
        double far = engine.scoreAudioFeatures(withAudio("c", 70.0, 0.1, 0.0, 0.1), seed);

        assertThat(identical).isEqualTo(15.0);
        assertThat(close).isLessThan(identical).isGreaterThan(10.0);
        assertThat(far).isEqualTo(0.0);
    }

    @Test
    @DisplayName("P1: Audio score is zero without seed audio and neutral for candidates without features")
    void shouldHandleMissingAudioFeatures() {
        SongDto noAudio = withAudio("d", null, null, null, null);
        AudioProfile seed = new AudioProfile(120.0, 0.8, 0.6, 0.7);

        assertThat(engine.scoreAudioFeatures(withAudio("a", 120.0, 0.8, 0.6, 0.7), null)).isEqualTo(0.0);
        assertThat(engine.scoreAudioFeatures(noAudio, seed)).isEqualTo(7.5);
        // Seed ka sirf energy pata hai: sirf energy ke points aayenge
        assertThat(engine.scoreAudioFeatures(withAudio("a", 60.0, 0.8, 0.0, 0.0),
                new AudioProfile(null, 0.8, null, null))).isEqualTo(4.0);
    }

    @Test
    @DisplayName("P6: Genre seed ranks preferred-genre songs above popular off-genre Recombee picks")
    void shouldRankByPreferredGenresWithGenreSeed() {
        Song seed = RecommendationRankingEngine.genreSeed(List.of("Rock", "Jazz"));
        assertThat(seed).isNotNull();
        assertThat(seed.getId()).isNull();

        SongDto popularPop = buildSongDto("pop", "Pop Hit", "Pop Star", "Pop", null, "English", 1_000_000L);
        Song rock = buildSongEntity("rock", "Rock Song", "Rock Band", "Rock", null, "English");

        List<SongDto> ranked = engine.rankAndDiversify(seed, List.of(popularPop), List.of(rock), Set.of(), 2);

        assertThat(ranked).extracting(SongDto::id).containsExactly("rock", "pop");
    }

    @Test
    @DisplayName("P6: Genre seed is null for empty preferences")
    void shouldReturnNullGenreSeedForEmptyPrefs() {
        assertThat(RecommendationRankingEngine.genreSeed(List.of())).isNull();
        assertThat(RecommendationRankingEngine.genreSeed(null)).isNull();
    }

    @Test
    @DisplayName("Audio-only seed (no seed song) ranks candidates by closeness to the target profile")
    void shouldRankByAudioWhenSeedIsProfileOnly() {
        AudioProfile chill = new AudioProfile(90.0, 0.3, 0.55, 0.45);
        Song near = buildSongEntity("near", "Near", "Artist N", "Pop", null, "English");
        near.setTempo(92.0); near.setEnergy(0.32); near.setValence(0.5); near.setDanceability(0.45);
        Song far = buildSongEntity("far", "Far", "Artist F", "Pop", null, "English");
        far.setTempo(140.0); far.setEnergy(0.95); far.setValence(0.9); far.setDanceability(0.9);

        for (int i = 0; i < 20; i++) { // random jitter (0..3) ~28 points ke fark ko kabhi ulat nahi sakta
            List<SongDto> ranked = engine.rankAndDiversify(null, chill, List.of(), List.of(far, near), Set.of(), 2);
            assertThat(ranked).extracting(SongDto::id).containsExactly("near", "far");
        }
    }

    @Test
    @DisplayName("DB candidates now carry stored features, so they score on real similarity, not neutral credit")
    void shouldScoreDbCandidatesOnStoredFeatures() {
        AudioProfile seed = new AudioProfile(120.0, 0.8, 0.6, 0.7);
        Song stored = buildSongEntity("stored", "S", "Artist S", "Pop", null, "English");
        stored.setTempo(120.0); stored.setEnergy(0.8); stored.setValence(0.6); stored.setDanceability(0.7);
        Song unknown = buildSongEntity("unknown", "U", "Artist U", "Pop", null, "English");

        assertThat(engine.scoreAudioFeatures(SongDto.fromEntity(stored), seed)).isEqualTo(15.0);
        assertThat(engine.scoreAudioFeatures(SongDto.fromEntity(unknown), seed)).isEqualTo(7.5);
    }

    @Test
    @DisplayName("Without seed song or seed audio, scoring stays Recombee + popularity only")
    void shouldKeepNoSeedScoringDeterministicWithoutAudio() {
        SongDto cand = withAudio("x", 120.0, 0.8, 0.6, 0.7);
        assertThat(engine.scoreCandidate(cand, null, null, 0)).isEqualTo(50.0);
    }
}

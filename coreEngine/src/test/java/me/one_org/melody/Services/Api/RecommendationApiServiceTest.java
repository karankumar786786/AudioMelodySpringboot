package me.one_org.melody.Services.Api;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import me.one_org.melody.Dto.Controllers.Api.RadioResponseDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Entity.User;
import me.one_org.melody.Entity.UserHistory;
import me.one_org.melody.Enums.StatusEnum;
import me.one_org.melody.Recommendation.AudioProfile;
import me.one_org.melody.Recommendation.Recombee;
import me.one_org.melody.Recommendation.RecommendationRankingEngine;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Repository.UserHistoryRepository;
import me.one_org.melody.Repository.UsersRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RecommendationApiServiceTest {

    @Mock
    private Recombee recombee;

    /** Ordered Recombee user recommendations with no audio features. */
    private static Map<String, AudioProfile> recs(String... ids) {
        Map<String, AudioProfile> m = new LinkedHashMap<>();
        for (String id : ids) m.put(id, null);
        return m;
    }

    @InjectMocks
    private RecommendationApiService recommendationApiService;

    @Test
    @DisplayName("Should return radio recommendations directly from Recombee")
    void shouldRecommendRadioDetailed() throws Exception {
        SongDto s1 = new SongDto("song-1", "Song One", "Artist A", 180, "key1", "img1", null, null, null, null, false, "English", "Pop", "Album", "India", "lrc", null, 120L, null);
        SongDto s2 = new SongDto("song-2", "Song Two", "Artist B", 200, "key2", "img2", null, null, null, null, false, "English", "Rock", "Album", "India", "lrc", null, 340L, null);

        when(recombee.recommendRadioDetailed(eq("seed-1"), eq(List.of("ex-1")), anyInt())).thenReturn(List.of(s1, s2));

        List<SongDto> dtos = recommendationApiService.recommendRadio("seed-1", List.of("ex-1"), 5);

        assertThat(dtos).hasSize(2);
        assertThat(dtos.get(0).id()).isEqualTo("song-1");
        assertThat(dtos.get(1).id()).isEqualTo("song-2");
        verify(recombee).recommendRadioDetailed(eq("seed-1"), eq(List.of("ex-1")), anyInt());
    }

    @Test
    @DisplayName("Should return similar recommendations directly from Recombee")
    void shouldRecommendSimilarDetailed() throws Exception {
        SongDto s1 = new SongDto("song-1", "Song One", "Artist A", 180, "key1", "img1", null, null, null, null, false, "English", "Pop", "Album", "India", "lrc", null, 120L, null);

        when(recombee.recommendRadioDetailed(eq("song-seed"), eq(List.of()), anyInt())).thenReturn(List.of(s1));

        List<SongDto> dtos = recommendationApiService.recommendSimilar("song-seed", 5);

        assertThat(dtos).hasSize(1);
        assertThat(dtos.get(0).id()).isEqualTo("song-1");
        verify(recombee).recommendRadioDetailed(eq("song-seed"), eq(List.of()), anyInt());
    }

    @Test
    @DisplayName("Should return empty list gracefully when Recombee fails and no songsRepository provided")
    void shouldHandleRecombeeFailureGracefully() throws Exception {
        when(recombee.recommendRadioDetailed(eq("seed-1"), eq(List.of()), anyInt())).thenThrow(new RuntimeException("Connection timeout"));

        List<SongDto> dtos = recommendationApiService.recommendRadio("seed-1", List.of(), 5);

        assertThat(dtos).isEmpty();
    }

    @Test
    @DisplayName("Should fallback to database songs by album, genre, artist, and language when Recombee returns empty")
    void shouldFallbackToDatabaseWhenRecombeeReturnsEmpty() throws Exception {
        me.one_org.melody.Repository.SongsRepository mockSongsRepo = mock(me.one_org.melody.Repository.SongsRepository.class);
        RecommendationApiService serviceWithFallback = new RecommendationApiService(recombee, mockSongsRepo);

        when(recombee.recommendRadioDetailed(eq("seed-1"), eq(List.of()), anyInt())).thenReturn(List.of());

        me.one_org.melody.Entity.Song seed = me.one_org.melody.Entity.Song.builder()
                .id("seed-1")
                .title("Seed Title")
                .artistName("Seed Artist")
                .genre("Pop")
                .album("Seed Album")
                .language("Hindi")
                .build();
        when(mockSongsRepo.findById("seed-1")).thenReturn(java.util.Optional.of(seed));

        me.one_org.melody.Entity.Song fallbackSong = me.one_org.melody.Entity.Song.builder()
                .id("song-fallback")
                .title("Fallback Title")
                .artistName("Different Artist")
                .genre("Pop")
                .album("Seed Album")
                .language("Hindi")
                .status(me.one_org.melody.Enums.StatusEnum.ACTIVE)
                .build();
        when(mockSongsRepo.findActiveByGenre(eq("Pop"), any()))
                .thenReturn(List.of(fallbackSong));

        List<SongDto> results = serviceWithFallback.recommendSimilar("seed-1", 5);

        assertThat(results).isNotEmpty();
        assertThat(results.get(0).id()).isEqualTo("song-fallback");
    }

    @Test
    @DisplayName("Should recommend for user from Recombee and hydrate from database")
    void shouldRecommendForUserFromRecombee() throws Exception {
        me.one_org.melody.Repository.SongsRepository mockSongsRepo = mock(me.one_org.melody.Repository.SongsRepository.class);
        RecommendationApiService service = new RecommendationApiService(recombee, mockSongsRepo);

        when(recombee.recommendForUserWithAudio(eq("user-1"), anyInt())).thenReturn(recs("song-1", "song-2"));

        me.one_org.melody.Entity.Song s1 = me.one_org.melody.Entity.Song.builder()
                .id("song-1")
                .title("Song 1")
                .artistName("Artist 1")
                .status(me.one_org.melody.Enums.StatusEnum.ACTIVE)
                .build();
        me.one_org.melody.Entity.Song s2 = me.one_org.melody.Entity.Song.builder()
                .id("song-2")
                .title("Song 2")
                .artistName("Artist 2")
                .status(me.one_org.melody.Enums.StatusEnum.ACTIVE)
                .build();

        when(mockSongsRepo.findAllByIds(List.of("song-1", "song-2"))).thenReturn(List.of(s1, s2));

        List<SongDto> results = service.recommendForUser("user-1", 5);

        assertThat(results).hasSize(2);
        assertThat(results.get(0).id()).isEqualTo("song-1");
        assertThat(results.get(1).id()).isEqualTo("song-2");
    }

    @Test
    @DisplayName("Should fallback to catalog songs when user recommendations fail or return empty")
    void shouldFallbackToCatalogWhenUserRecommendationsEmpty() throws Exception {
        me.one_org.melody.Repository.SongsRepository mockSongsRepo = mock(me.one_org.melody.Repository.SongsRepository.class);
        RecommendationApiService service = new RecommendationApiService(recombee, mockSongsRepo);

        when(recombee.recommendForUserWithAudio(eq("user-new"), anyInt())).thenReturn(recs());

        me.one_org.melody.Entity.Song catalogSong = me.one_org.melody.Entity.Song.builder()
                .id("song-cat")
                .title("Catalog Track")
                .artistName("Catalog Artist")
                .status(me.one_org.melody.Enums.StatusEnum.ACTIVE)
                .build();

        when(mockSongsRepo.findActiveSongs(any()))
                .thenReturn(List.of(catalogSong));

        List<SongDto> results = service.recommendForUser("user-new", 5);

        assertThat(results).hasSize(1);
        assertThat(results.get(0).id()).isEqualTo("song-cat");
    }

    @Test
    @DisplayName("Should query database candidates for each genre token when seed genre contains commas")
    void shouldFallbackToMultiGenreTokensWhenSeedHasCommaSeparatedGenres() throws Exception {
        me.one_org.melody.Repository.SongsRepository mockSongsRepo = mock(me.one_org.melody.Repository.SongsRepository.class);
        RecommendationApiService service = new RecommendationApiService(recombee, mockSongsRepo);

        when(recombee.recommendRadioDetailed(eq("multi-seed"), eq(List.of()), anyInt())).thenReturn(List.of());

        me.one_org.melody.Entity.Song multiGenreSeed = me.one_org.melody.Entity.Song.builder()
                .id("multi-seed")
                .title("Multi Genre Hit")
                .artistName("Fusion Band")
                .genre("Pop, Dance, Electronic")
                .album("Fusion Album")
                .language("English")
                .build();
        when(mockSongsRepo.findById("multi-seed")).thenReturn(java.util.Optional.of(multiGenreSeed));

        me.one_org.melody.Entity.Song danceSong = me.one_org.melody.Entity.Song.builder()
                .id("song-dance")
                .title("Dance Beat")
                .artistName("DJ Groove")
                .genre("Dance")
                .language("English")
                .status(me.one_org.melody.Enums.StatusEnum.ACTIVE)
                .build();

        me.one_org.melody.Entity.Song electroSong = me.one_org.melody.Entity.Song.builder()
                .id("song-electro")
                .title("Electro Synth")
                .artistName("Synth Wave")
                .genre("Electronic")
                .language("English")
                .status(me.one_org.melody.Enums.StatusEnum.ACTIVE)
                .build();

        when(mockSongsRepo.findActiveByGenre(eq("Pop"), any())).thenReturn(List.of());
        when(mockSongsRepo.findActiveByGenre(eq("Dance"), any())).thenReturn(List.of(danceSong));
        when(mockSongsRepo.findActiveByGenre(eq("Electronic"), any())).thenReturn(List.of(electroSong));

        List<SongDto> results = service.recommendSimilar("multi-seed", 5);

        assertThat(results).isNotEmpty();
        verify(mockSongsRepo).findActiveByGenre(eq("Pop"), any());
        verify(mockSongsRepo).findActiveByGenre(eq("Dance"), any());
        verify(mockSongsRepo).findActiveByGenre(eq("Electronic"), any());
    }

    @Test
    @DisplayName("Should query database candidates for each artist token when seed artist contains commas")
    void shouldFallbackToMultiArtistTokensWhenSeedHasCommaSeparatedArtists() throws Exception {
        me.one_org.melody.Repository.SongsRepository mockSongsRepo = mock(me.one_org.melody.Repository.SongsRepository.class);
        RecommendationApiService service = new RecommendationApiService(recombee, mockSongsRepo);

        when(recombee.recommendRadioDetailed(eq("artist-seed"), eq(List.of()), anyInt())).thenReturn(List.of());

        me.one_org.melody.Entity.Song multiArtistSeed = me.one_org.melody.Entity.Song.builder()
                .id("artist-seed")
                .title("Collab Track")
                .artistName("Drake, 21 Savage")
                .genre("Hip Hop")
                .album("Her Loss")
                .language("English")
                .build();
        when(mockSongsRepo.findById("artist-seed")).thenReturn(java.util.Optional.of(multiArtistSeed));

        me.one_org.melody.Entity.Song drakeSolo = me.one_org.melody.Entity.Song.builder()
                .id("drake-solo")
                .title("God's Plan")
                .artistName("Drake")
                .genre("Hip Hop")
                .language("English")
                .status(me.one_org.melody.Enums.StatusEnum.ACTIVE)
                .build();

        me.one_org.melody.Entity.Song savageSolo = me.one_org.melody.Entity.Song.builder()
                .id("savage-solo")
                .title("Redrum")
                .artistName("21 Savage")
                .genre("Hip Hop")
                .language("English")
                .status(me.one_org.melody.Enums.StatusEnum.ACTIVE)
                .build();

        when(mockSongsRepo.findActiveByGenre(any(), any())).thenReturn(List.of());
        when(mockSongsRepo.findActiveByLanguage(any(), any())).thenReturn(List.of());
        when(mockSongsRepo.findByAlbum(any())).thenReturn(List.of());
        when(mockSongsRepo.findActiveSongs(any())).thenReturn(List.of());
        when(mockSongsRepo.findActiveByArtistName(eq("Drake"), any())).thenReturn(List.of(drakeSolo));
        when(mockSongsRepo.findActiveByArtistName(eq("21 Savage"), any())).thenReturn(List.of(savageSolo));

        List<SongDto> results = service.recommendSimilar("artist-seed", 5);

        assertThat(results).isNotEmpty();
        verify(mockSongsRepo).findActiveByArtistName(eq("Drake"), any());
        verify(mockSongsRepo).findActiveByArtistName(eq("21 Savage"), any());
    }

    @Test
    @DisplayName("Should use top-20 history to pick best-completed vibe seed and query top-3 weighted genres")
    void shouldBuildWeightedGenreProfileAndPickBestVibeSeedFromHistory() throws Exception {
        SongsRepository mockSongsRepo = mock(SongsRepository.class);
        UserHistoryRepository mockHistoryRepo = mock(UserHistoryRepository.class);
        UsersRepository mockUsersRepo = mock(UsersRepository.class);
        RecommendationRankingEngine mockRankingEngine = mock(RecommendationRankingEngine.class);

        RecommendationApiService service = new RecommendationApiService(
                recombee, mockSongsRepo, mockHistoryRepo, mockUsersRepo, mockRankingEngine);

        when(recombee.recommendForUserWithAudio(eq("user-1"), anyInt())).thenReturn(recs());

        User user = User.builder().id("user-1").userName("testuser").build();
        when(mockUsersRepo.findById("user-1")).thenReturn(Optional.of(user));

        Song songLowCompletion = Song.builder().id("s-recent").genre("Pop").build();
        Song songHighCompletion = Song.builder().id("s-completed").genre("Rock").build();

        UserHistory h1 = new UserHistory("h1", user, songLowCompletion, 20, null);
        UserHistory h2 = new UserHistory("h2", user, songHighCompletion, 95, null);

        when(mockHistoryRepo.findRecentByUser(eq(user), eq(20))).thenReturn(List.of(h1, h2));

        Song rockSong = Song.builder().id("s-rock-candidate").title("Rock Song").genre("Rock").status(StatusEnum.ACTIVE).build();
        when(mockSongsRepo.findActiveByGenre(eq("Rock"), any())).thenReturn(List.of(rockSong));
        when(mockSongsRepo.findActiveByGenre(eq("Pop"), any())).thenReturn(List.of());
        when(mockSongsRepo.findActiveSongs(any())).thenReturn(List.of());

        when(mockRankingEngine.rankAndDiversify(eq(songHighCompletion), any(), any(), any(), any(), anyInt()))
                .thenReturn(List.of(SongDto.fromEntity(rockSong)));

        List<SongDto> result = service.recommendForUser("user-1", 5);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).id()).isEqualTo("s-rock-candidate");
        verify(mockHistoryRepo).findRecentByUser(user, 20);
        verify(mockRankingEngine).rankAndDiversify(eq(songHighCompletion), any(), any(), any(), any(), eq(5));
    }

    @Test
    @DisplayName("Should return radio session recommendations with recommId")
    void shouldRecommendRadioSessionWithRecommId() throws Exception {
        SongDto s1 = new SongDto("song-1", "Song One", "Artist A", 180, "key1", "img1", null, null, null, null, false, "English", "Pop", "Album", "India", "lrc", null, 120L, null);
        RadioResponseDto recombeeDto = new RadioResponseDto(List.of(s1), "rec-session-123");

        when(recombee.recommendRadioWithRecommId(eq("seed-1"), eq(List.of()), anyInt())).thenReturn(recombeeDto);

        RadioResponseDto result = recommendationApiService.recommendRadioSession("seed-1", List.of(), 5);

        assertThat(result).isNotNull();
        assertThat(result.recommId()).isEqualTo("rec-session-123");
        assertThat(result.songs()).hasSize(1);
        assertThat(result.songs().get(0).id()).isEqualTo("song-1");
        verify(recombee).recommendRadioWithRecommId(eq("seed-1"), eq(List.of()), anyInt());
    }

    @Test
    @DisplayName("Should send repeat listen rating signals to Recombee for songs played 3+ times with >= 70% completion")
    void shouldTrackRepeatListenSignalsForFrequentlyPlayedSongs() throws Exception {
        SongsRepository mockSongsRepo = mock(SongsRepository.class);
        UserHistoryRepository mockHistoryRepo = mock(UserHistoryRepository.class);
        UsersRepository mockUsersRepo = mock(UsersRepository.class);

        RecommendationApiService service = new RecommendationApiService(
                recombee, mockSongsRepo, mockHistoryRepo, mockUsersRepo, null);

        User user = User.builder().id("user-1").userName("testuser").build();
        when(mockUsersRepo.findById("user-1")).thenReturn(Optional.of(user));
        when(recombee.recommendForUserWithAudio(eq("user-1"), anyInt())).thenReturn(recs());

        // Frequent songs query: [songId, count, avgCompletion]
        Object[] row1 = new Object[]{"song-frequent-1", 5L, 85.0};
        Object[] row2 = new Object[]{"song-low-completion", 4L, 50.0};
        when(mockHistoryRepo.findFrequentlyPlayedSongs(eq(user), any(), eq(3L), any()))
                .thenReturn(List.of(row1, row2));

        service.recommendForUser("user-1", 5);

        verify(recombee).trackRating(eq("user-1"), eq("song-frequent-1"), eq(1.0));
        verify(recombee, never()).trackRating(eq("user-1"), eq("song-low-completion"), anyDouble());
    }

    @Test
    @DisplayName("P6: Cold-start user with genre prefs is ranked against a genre seed built from those prefs")
    void shouldRankColdStartUserAgainstPreferredGenres() throws Exception {
        SongsRepository mockSongsRepo = mock(SongsRepository.class);
        UserHistoryRepository mockHistoryRepo = mock(UserHistoryRepository.class);
        UsersRepository mockUsersRepo = mock(UsersRepository.class);
        UserGenrePreferenceService prefs = mock(UserGenrePreferenceService.class);

        RecommendationApiService service = new RecommendationApiService(
                recombee, mockSongsRepo, mockHistoryRepo, mockUsersRepo, null, prefs, null);

        User user = User.builder().id("user-new").userName("newbie").build();
        when(mockUsersRepo.findById("user-new")).thenReturn(Optional.of(user));
        when(mockHistoryRepo.findRecentByUser(eq(user), eq(20))).thenReturn(List.of());
        when(prefs.getPreferences(user)).thenReturn(List.of("Rock"));

        // Recombee returns a very popular pop song; the DB returns a rock song with no streams.
        Song popHit = Song.builder().id("pop-hit").title("Pop Hit").artistName("Pop Star")
                .genre("Pop").status(StatusEnum.ACTIVE).build();
        Song rockSong = Song.builder().id("rock-1").title("Rock Song").artistName("Rock Band")
                .genre("Rock").status(StatusEnum.ACTIVE).build();
        when(recombee.recommendForUserWithAudio(eq("user-new"), anyInt())).thenReturn(recs("pop-hit"));
        when(mockSongsRepo.findAllByIds(List.of("pop-hit"))).thenReturn(List.of(popHit));
        when(mockSongsRepo.findActiveByGenre(eq("Rock"), any())).thenReturn(List.of(rockSong));
        when(mockSongsRepo.findActiveSongs(any())).thenReturn(List.of());

        List<SongDto> result = service.recommendForUser("user-new", 5);

        assertThat(result).extracting(SongDto::id).containsExactly("rock-1", "pop-hit");
        verify(prefs).getPreferences(user);
        verify(prefs, never()).hasPreferences(any());
    }

    @Test
    @DisplayName("P1: Home feed attaches Recombee audio features to hydrated songs and uses seed audio")
    void shouldAttachAudioFeaturesAndSeedAudioForUserFeed() throws Exception {
        SongsRepository mockSongsRepo = mock(SongsRepository.class);
        UserHistoryRepository mockHistoryRepo = mock(UserHistoryRepository.class);
        UsersRepository mockUsersRepo = mock(UsersRepository.class);
        RecommendationRankingEngine mockRankingEngine = mock(RecommendationRankingEngine.class);

        RecommendationApiService service = new RecommendationApiService(
                recombee, mockSongsRepo, mockHistoryRepo, mockUsersRepo, mockRankingEngine);

        User user = User.builder().id("user-1").userName("testuser").build();
        when(mockUsersRepo.findById("user-1")).thenReturn(Optional.of(user));
        Song seed = Song.builder().id("seed").genre("Rock").build();
        when(mockHistoryRepo.findRecentByUser(eq(user), eq(20)))
                .thenReturn(List.of(new UserHistory("h1", user, seed, 100, null)));

        AudioProfile candAudio = new AudioProfile(120.0, 0.7, 0.5, 0.6);
        AudioProfile seedAudio = new AudioProfile(118.0, 0.72, 0.5, 0.62);
        Map<String, AudioProfile> recMap = new LinkedHashMap<>();
        recMap.put("rec-1", candAudio);
        when(recombee.recommendForUserWithAudio(eq("user-1"), anyInt())).thenReturn(recMap);
        when(recombee.getAudioProfile("seed")).thenReturn(seedAudio);
        Song rec1 = Song.builder().id("rec-1").status(StatusEnum.ACTIVE).build();
        when(mockSongsRepo.findAllByIds(List.of("rec-1"))).thenReturn(List.of(rec1));
        when(mockSongsRepo.findActiveByGenre(eq("Rock"), any())).thenReturn(List.of());
        when(mockSongsRepo.findActiveSongs(any())).thenReturn(List.of());
        when(mockRankingEngine.rankAndDiversify(any(), any(), any(), any(), any(), anyInt())).thenReturn(List.of());

        service.recommendForUser("user-1", 5);

        @SuppressWarnings("unchecked")
        org.mockito.ArgumentCaptor<List<SongDto>> captor = org.mockito.ArgumentCaptor.forClass(List.class);
        verify(mockRankingEngine).rankAndDiversify(eq(seed), eq(seedAudio), captor.capture(), any(), any(), eq(5));
        assertThat(captor.getValue()).singleElement().satisfies(dto -> {
            assertThat(dto.tempo()).isEqualTo(120.0);
            assertThat(dto.energy()).isEqualTo(0.7);
        });
    }

    @Test
    @DisplayName("Radio uses the seed song's stored features and skips the Recombee profile lookup")
    void shouldUseStoredSeedFeaturesWithoutRecombeeLookup() {
        SongsRepository mockSongsRepo = mock(SongsRepository.class);
        RecommendationRankingEngine mockRankingEngine = mock(RecommendationRankingEngine.class);
        RecommendationApiService service = new RecommendationApiService(
                recombee, mockSongsRepo, null, null, mockRankingEngine);

        Song seed = Song.builder().id("seed").genre("Rock").status(StatusEnum.ACTIVE)
                .tempo(118.0).energy(0.7).valence(0.4).danceability(0.6).build();
        when(mockSongsRepo.findById("seed")).thenReturn(Optional.of(seed));
        when(mockRankingEngine.rankAndDiversify(any(), any(), any(), any(), any(), anyInt()))
                .thenReturn(List.of(SongDto.fromEntity(Song.builder().id("r1").build())));

        service.recommendRadio("seed", List.of(), 5);
        service.recommendRadioSession("seed", List.of(), 5);

        verify(recombee, never()).getAudioProfile(anyString());
        verify(mockRankingEngine, times(2)).rankAndDiversify(
                eq(seed), eq(new AudioProfile(118.0, 0.7, 0.4, 0.6)), any(), any(), any(), eq(5));
    }

    @Test
    @DisplayName("Seed profile falls back to Recombee only when the song row has no features")
    void shouldFallBackToRecombeeProfileWhenSeedHasNoFeatures() {
        RecommendationApiService service = new RecommendationApiService(recombee);
        AudioProfile remote = new AudioProfile(100.0, 0.5, 0.5, 0.5);
        when(recombee.getAudioProfile("bare")).thenReturn(remote);

        assertThat(service.seedAudioProfile(Song.builder().id("bare").build())).isEqualTo(remote);
        assertThat(service.seedAudioProfile(RecommendationRankingEngine.genreSeed(List.of("pop")))).isNull();
        verify(recombee, times(1)).getAudioProfile(anyString());
    }

    @Test
    @DisplayName("Home feed keeps a song's stored features over the ones Recombee returned")
    void shouldPreferStoredCandidateFeaturesOverRecombee() throws Exception {
        SongsRepository mockSongsRepo = mock(SongsRepository.class);
        RecommendationRankingEngine mockRankingEngine = mock(RecommendationRankingEngine.class);
        RecommendationApiService service = new RecommendationApiService(
                recombee, mockSongsRepo, null, null, mockRankingEngine);

        Map<String, AudioProfile> recMap = new LinkedHashMap<>();
        recMap.put("rec-1", new AudioProfile(60.0, 0.1, 0.1, 0.1));
        when(recombee.recommendForUserWithAudio(eq("user-1"), anyInt())).thenReturn(recMap);
        Song rec1 = Song.builder().id("rec-1").status(StatusEnum.ACTIVE).tempo(128.0).energy(0.9).build();
        when(mockSongsRepo.findAllByIds(List.of("rec-1"))).thenReturn(List.of(rec1));
        when(mockSongsRepo.findActiveSongs(any())).thenReturn(List.of());
        when(mockRankingEngine.rankAndDiversify(any(), any(), any(), any(), any(), anyInt())).thenReturn(List.of());

        service.recommendForUser("user-1", 5);

        @SuppressWarnings("unchecked")
        org.mockito.ArgumentCaptor<List<SongDto>> captor = org.mockito.ArgumentCaptor.forClass(List.class);
        verify(mockRankingEngine).rankAndDiversify(isNull(), isNull(), captor.capture(), any(), any(), eq(5));
        assertThat(captor.getValue()).singleElement().satisfies(dto -> {
            assertThat(dto.tempo()).isEqualTo(128.0);
            assertThat(dto.energy()).isEqualTo(0.9);
        });
    }
}

package me.one_org.melody.Services.Api;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Recommendation.Recombee;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RecommendationApiServiceTest {

    @Mock
    private Recombee recombee;

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

        when(recombee.recommendForUser(eq("user-1"), anyInt())).thenReturn(List.of("song-1", "song-2"));

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

        when(recombee.recommendForUser(eq("user-new"), anyInt())).thenReturn(List.of());

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
}

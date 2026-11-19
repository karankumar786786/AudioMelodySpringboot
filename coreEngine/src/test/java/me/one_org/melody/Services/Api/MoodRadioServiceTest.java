package me.one_org.melody.Services.Api;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Entity.User;
import me.one_org.melody.Entity.UserHistory;
import me.one_org.melody.Enums.StatusEnum;
import me.one_org.melody.Recommendation.Mood;
import me.one_org.melody.Recommendation.RecommendationRankingEngine;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Repository.UserHistoryRepository;
import me.one_org.melody.Repository.UsersRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MoodRadioServiceTest {

    @Mock private SongsRepository songsRepository;
    @Mock private UserHistoryRepository userHistoryRepository;
    @Mock private UsersRepository usersRepository;

    private MoodRadioService service;

    @BeforeEach
    void setUp() {
        // Real engine: the point is that mood ranking goes through the shared scorer
        service = new MoodRadioService(songsRepository, userHistoryRepository, usersRepository,
                new RecommendationRankingEngine());
    }

    private static Song song(String id, String artist, double tempo, double energy, double valence, double dance) {
        return Song.builder().id(id).title("T " + id).artistName(artist).genre("Pop").language("English")
                .status(StatusEnum.ACTIVE).tempo(tempo).energy(energy).valence(valence).danceability(dance).build();
    }

    private void stubCandidates(List<Song> songs) {
        when(songsRepository.findActiveByAudioRange(anyDouble(), anyDouble(), anyDouble(), anyDouble(),
                anyDouble(), anyDouble(), any(Pageable.class))).thenReturn(songs);
    }

    @Test
    @DisplayName("queries the mood's feature ranges and ranks closest-to-target first")
    void shouldQueryRangesAndRankByTarget() {
        stubCandidates(List.of(
                song("edge", "A1", 112.0, 0.66, 0.35, 0.5),
                song("ideal", "A2", 130.0, 0.85, 0.65, 0.75),
                song("close", "A3", 125.0, 0.8, 0.6, 0.7)));

        List<SongDto> result = service.recommendMood(Mood.WORKOUT, null, 3);

        assertThat(result).extracting(SongDto::id).containsExactly("ideal", "close", "edge");
        ArgumentCaptor<Pageable> page = ArgumentCaptor.forClass(Pageable.class);
        verify(songsRepository).findActiveByAudioRange(eq(0.65), eq(1.0), eq(0.30), eq(1.0),
                eq(110.0), eq(185.0), page.capture());
        assertThat(page.getValue().getPageSize()).isEqualTo(MoodRadioService.MIN_CANDIDATE_POOL);
        verifyNoInteractions(usersRepository, userHistoryRepository);
    }

    @Test
    @DisplayName("excludes the logged-in user's recently played songs when enough others match")
    void shouldExcludeRecentlyPlayed() {
        Song played = song("played", "A1", 90.0, 0.3, 0.55, 0.45);
        stubCandidates(List.of(played, song("fresh-1", "A2", 92.0, 0.32, 0.5, 0.45),
                song("fresh-2", "A3", 85.0, 0.25, 0.6, 0.4)));
        User user = User.builder().id("u1").userName("u").build();
        when(usersRepository.findById("u1")).thenReturn(Optional.of(user));
        when(userHistoryRepository.findRecentByUser(user, 50))
                .thenReturn(List.of(new UserHistory("h1", user, played, 100, null)));

        List<SongDto> result = service.recommendMood(Mood.CHILL, "u1", 2);

        assertThat(result).extracting(SongDto::id).containsExactlyInAnyOrder("fresh-1", "fresh-2");
    }

    @Test
    @DisplayName("tops up with recently played matches rather than returning a short queue")
    void shouldTopUpFromRecentlyPlayedWhenCatalogIsSmall() {
        Song played = song("played", "A1", 90.0, 0.3, 0.55, 0.45);
        stubCandidates(List.of(played, song("fresh", "A2", 92.0, 0.32, 0.5, 0.45)));
        User user = User.builder().id("u1").userName("u").build();
        when(usersRepository.findById("u1")).thenReturn(Optional.of(user));
        when(userHistoryRepository.findRecentByUser(user, 50))
                .thenReturn(List.of(new UserHistory("h1", user, played, 100, null)));

        List<SongDto> result = service.recommendMood(Mood.CHILL, "u1", 5);

        assertThat(result).extracting(SongDto::id).containsExactly("fresh", "played");
    }

    @Test
    @DisplayName("clamps count, enforces artist diversity, and returns empty when nothing matches")
    void shouldClampCountAndHandleEmpty() {
        List<Song> many = new ArrayList<>();
        for (int i = 0; i < 80; i++) many.add(song("s" + i, "Artist " + i, 120.0, 0.7, 0.85, 0.7));
        stubCandidates(many);
        assertThat(service.recommendMood(Mood.HAPPY, null, 500)).hasSize(MoodRadioService.MAX_COUNT);
        assertThat(service.recommendMood(Mood.HAPPY, null, 0)).hasSize(MoodRadioService.DEFAULT_COUNT);

        stubCandidates(List.of());
        assertThat(service.recommendMood(Mood.SAD, "anonymous", 10)).isEmpty();
        assertThatThrownBy(() -> service.recommendMood(null, null, 10)).isInstanceOf(IllegalArgumentException.class);
    }
}

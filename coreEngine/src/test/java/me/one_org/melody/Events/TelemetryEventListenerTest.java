package me.one_org.melody.Events;

import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import me.one_org.melody.AlgoliaSearch.AlgoliaSearch;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Entity.SongMetadata;
import me.one_org.melody.Recommendation.Recombee;
import me.one_org.melody.Repository.SongMetadataRepository;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Services.Api.ArtistApiService;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TelemetryEventListenerTest {

    @Mock
    private Recombee recombee;

    @Mock
    private ArtistApiService artistApiService;

    @Mock
    private AlgoliaSearch algoliaSearch;

    @Mock
    private SongMetadataRepository songMetadataRepository;

    @Mock
    private SongsRepository songsRepository;

    @InjectMocks
    private TelemetryEventListener eventListener;

    @Test
    @DisplayName("Should increment DB, Algolia, and Recombee on SongPlayEvent")
    void shouldHandleSongPlayEvent() throws Exception {
        when(songMetadataRepository.incrementStreams("song-1")).thenReturn(1);
        SongMetadata meta = SongMetadata.builder().totalStreams(50L).build();
        when(songMetadataRepository.findBySong_Id("song-1")).thenReturn(Optional.of(meta));

        TelemetryEvents.SongPlayEvent event = new TelemetryEvents.SongPlayEvent("user-1", "song-1", 0.95);
        eventListener.onSongPlay(event);

        verify(songMetadataRepository).incrementStreams("song-1");
        verify(algoliaSearch).incrementTotalStreams("song-1");
        verify(recombee).trackPlay("user-1", "song-1", 0.95);
        verify(recombee).updateTotalStreams("song-1", 50L);
    }

    @Test
    @DisplayName("Should create SongMetadata if incrementStreams returns 0")
    void shouldCreateSongMetadataIfMissing() throws Exception {
        when(songMetadataRepository.incrementStreams("song-new")).thenReturn(0);
        Song mockSong = Song.builder().id("song-new").build();
        when(songsRepository.getReferenceById("song-new")).thenReturn(mockSong);

        TelemetryEvents.SongPlayEvent event = new TelemetryEvents.SongPlayEvent("user-1", "song-new", 0.80);
        eventListener.onSongPlay(event);

        verify(songMetadataRepository).save(any(SongMetadata.class));
        verify(algoliaSearch).incrementTotalStreams("song-new");
        verify(recombee).trackPlay("user-1", "song-new", 0.80);
        verify(recombee).updateTotalStreams("song-new", 1L);
    }

    @Test
    @DisplayName("Should delegate artist follow to Recombee")
    void shouldTrackArtistFollow() throws Exception {
        TelemetryEvents.ArtistFollowEvent event = new TelemetryEvents.ArtistFollowEvent("user-1", "artist-99");
        eventListener.onArtistFollow(event);

        verify(recombee).trackArtistFollow("user-1", "artist-99");
    }

    @Test
    @DisplayName("Should delegate artist unfollow to Recombee")
    void shouldTrackArtistUnfollow() throws Exception {
        TelemetryEvents.ArtistUnfollowEvent event = new TelemetryEvents.ArtistUnfollowEvent("user-1", "artist-99");
        eventListener.onArtistUnfollow(event);

        verify(recombee).trackArtistUnfollow("user-1", "artist-99");
    }
}

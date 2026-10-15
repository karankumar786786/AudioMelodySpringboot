package me.one_org.melody.Recommendation;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.recombee.api_client.RecombeeClient;
import com.recombee.api_client.api_requests.AddRating;
import com.recombee.api_client.api_requests.Request;
import com.recombee.api_client.api_requests.SetItemValues;

import me.one_org.melody.Entity.Song;
import me.one_org.melody.Entity.SongMetadata;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RecombeeTest {

    @Mock
    private RecombeeClient recombeeClient;

    @InjectMocks
    private Recombee recombee;

    @Test
    @DisplayName("Should save Song with totalStreams in Recombee")
    void shouldSaveSongWithTotalStreams() throws Exception {
        SongMetadata metadata = SongMetadata.builder()
                .id("meta-10")
                .totalStreams(1200L)
                .build();

        Song song = Song.builder()
                .id("song-10")
                .title("Imagine")
                .artistName("John Lennon")
                .language("English")
                .genre("Rock")
                .songMetadata(metadata)
                .build();

        recombee.saveSong(song);

        ArgumentCaptor<Request> captor = ArgumentCaptor.forClass(Request.class);
        verify(recombeeClient).send(captor.capture());

        assertThat(captor.getValue()).isInstanceOf(SetItemValues.class);
        SetItemValues setItemValues = (SetItemValues) captor.getValue();
        assertThat(setItemValues.getItemId()).isEqualTo("song-10");
    }

    @Test
    @DisplayName("Should update totalStreams property in Recombee")
    void shouldUpdateTotalStreams() throws Exception {
        recombee.updateTotalStreams("song-99", 5800L);

        ArgumentCaptor<Request> captor = ArgumentCaptor.forClass(Request.class);
        verify(recombeeClient).send(captor.capture());

        assertThat(captor.getValue()).isInstanceOf(SetItemValues.class);
        SetItemValues setItemValues = (SetItemValues) captor.getValue();
        assertThat(setItemValues.getItemId()).isEqualTo("song-99");
    }

    @Test
    @DisplayName("Should record 0.7 rating for completed song (>=90%)")
    void shouldRecordStrongPositiveForCompletedSong() throws Exception {
        recombee.trackPlay("user-1", "song-1", 0.95);

        ArgumentCaptor<Request> captor = ArgumentCaptor.forClass(Request.class);
        verify(recombeeClient).send(captor.capture());

        assertThat(captor.getValue()).isInstanceOf(AddRating.class);
        AddRating rating = (AddRating) captor.getValue();
        assertThat(rating.getRating()).isEqualTo(0.7);
        assertThat(rating.getUserId()).isEqualTo("user-1");
        assertThat(rating.getItemId()).isEqualTo("song-1");
    }

    @Test
    @DisplayName("Should record -0.3 rating for drop-off song (<25%)")
    void shouldRecordSoftNegativeForDropOff() throws Exception {
        recombee.trackPlay("user-1", "song-2", 0.15);

        ArgumentCaptor<Request> captor = ArgumentCaptor.forClass(Request.class);
        verify(recombeeClient).send(captor.capture());

        assertThat(captor.getValue()).isInstanceOf(AddRating.class);
        AddRating rating = (AddRating) captor.getValue();
        assertThat(rating.getRating()).isEqualTo(-0.3);
    }
}

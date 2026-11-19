package me.one_org.melody.Dto.Controllers.Api;

import java.time.LocalDateTime;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import me.one_org.melody.Entity.Song;
import me.one_org.melody.Entity.SongMetadata;
import me.one_org.melody.Enums.StatusEnum;

import static org.assertj.core.api.Assertions.assertThat;

class SongDtoTest {

    @Test
    @DisplayName("Should return null DTO when source entity is null")
    void shouldReturnNullWhenEntityIsNull() {
        assertThat(SongDto.fromEntity(null)).isNull();
    }

    @Test
    @DisplayName("Should default totalStreams to 0 when SongMetadata is null")
    void shouldDefaultStreamsToZeroWhenMetadataMissing() {
        Song song = Song.builder()
                .id("song-1")
                .title("Test Song")
                .artistName("Test Artist")
                .duration(200)
                .songKey("song/key")
                .imageKey("image/key")
                .isFeatured(false)
                .language("Hindi")
                .genre("Pop")
                .album("Album A")
                .lrclibId("lrc-1")
                .status(StatusEnum.ACTIVE)
                .songMetadata(null)
                .createdAt(LocalDateTime.now())
                .build();

        SongDto dto = SongDto.fromEntity(song);

        assertThat(dto).isNotNull();
        assertThat(dto.id()).isEqualTo("song-1");
        assertThat(dto.totalStreams()).isEqualTo(0L);
    }

    @Test
    @DisplayName("Should extract totalStreams from SongMetadata")
    void shouldExtractTotalStreamsFromMetadata() {
        SongMetadata metadata = SongMetadata.builder()
                .id("meta-1")
                .totalStreams(7420L)
                .build();

        Song song = Song.builder()
                .id("song-2")
                .title("Hit Track")
                .artistName("Star Artist")
                .duration(180)
                .songKey("song/key2")
                .imageKey("image/key2")
                .isFeatured(true)
                .language("English")
                .genre("Electronic")
                .album("Dance Hits")
                .lrclibId("lrc-2")
                .status(StatusEnum.ACTIVE)
                .songMetadata(metadata)
                .createdAt(LocalDateTime.now())
                .build();

        SongDto dto = SongDto.fromEntity(song);

        assertThat(dto).isNotNull();
        assertThat(dto.id()).isEqualTo("song-2");
        assertThat(dto.totalStreams()).isEqualTo(7420L);
    }

    @Test
    @DisplayName("fromEntity maps stored audio features (V15) onto the DTO")
    void shouldMapAudioFeaturesFromEntity() {
        Song song = Song.builder().id("song-a").title("T").artistName("A").status(StatusEnum.ACTIVE)
                .tempo(124.5).energy(0.81).valence(0.42).danceability(0.67).build();

        SongDto dto = SongDto.fromEntity(song, true, 3L);

        assertThat(dto.tempo()).isEqualTo(124.5);
        assertThat(dto.energy()).isEqualTo(0.81);
        assertThat(dto.valence()).isEqualTo(0.42);
        assertThat(dto.danceability()).isEqualTo(0.67);
        assertThat(dto.hasAudioFeatures()).isTrue();
        assertThat(dto.isLiked()).isTrue();
    }

    @Test
    @DisplayName("fromEntity leaves audio features null for songs not yet analysed")
    void shouldLeaveAudioFeaturesNullWhenEntityHasNone() {
        SongDto dto = SongDto.fromEntity(Song.builder().id("song-b").build());
        assertThat(dto.tempo()).isNull();
        assertThat(dto.energy()).isNull();
        assertThat(dto.valence()).isNull();
        assertThat(dto.danceability()).isNull();
        assertThat(dto.hasAudioFeatures()).isFalse();
    }
}

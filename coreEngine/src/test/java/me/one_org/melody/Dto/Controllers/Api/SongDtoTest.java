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
}

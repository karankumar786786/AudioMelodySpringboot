package me.one_org.melody.Dto.Controllers.Api;

import java.time.LocalDateTime;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Enums.StatusEnum;

public record SongDto(
    String id,
    String title,
    String artistName,
    Integer duration,
    String songKey,
    String imageKey,
    String videoKey,
    String fullVideoKey,
    Integer previewStartTime,
    Integer previewEndTime,
    Boolean isFeatured,
    String language,
    String genre,
    String album,
    String lrclibId,
    StatusEnum status,
    Long totalStreams,
    LocalDateTime createdAt
) {
    public static SongDto fromEntity(Song song) {
        if (song == null) return null;
        Long streams = song.getSongMetadata() != null ? song.getSongMetadata().getTotalStreams() : 0L;
        return new SongDto(
            song.getId(),
            song.getTitle(),
            song.getArtistName(),
            song.getDuration(),
            song.getSongKey(),
            song.getImageKey(),
            song.getVideoKey(),
            song.getFullVideoKey(),
            song.getPreviewStartTime(),
            song.getPreviewEndTime(),
            song.getIsFeatured(),
            song.getLanguage(),
            song.getGenre(),
            song.getAlbum(),
            song.getLrclibId(),
            song.getStatus(),
            streams,
            song.getCreatedAt()
        );
    }
}

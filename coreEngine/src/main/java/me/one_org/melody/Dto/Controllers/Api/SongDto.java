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
    String country,
    String lrclibId,
    StatusEnum status,
    String jobId,
    Long totalStreams,
    LocalDateTime createdAt,
    Boolean isLiked,
    Long likesCount
) {
    public SongDto(
        String id, String title, String artistName, Integer duration, String songKey, String imageKey,
        String videoKey, String fullVideoKey, Integer previewStartTime, Integer previewEndTime,
        Boolean isFeatured, String language, String genre, String album, String country, String lrclibId,
        StatusEnum status, String jobId, Long totalStreams, LocalDateTime createdAt
    ) {
        this(id, title, artistName, duration, songKey, imageKey, videoKey, fullVideoKey,
             previewStartTime, previewEndTime, isFeatured, language, genre, album, country, lrclibId,
             status, jobId, totalStreams, createdAt, null, null);
    }

    public SongDto(
        String id, String title, String artistName, Integer duration, String songKey, String imageKey,
        String videoKey, String fullVideoKey, Integer previewStartTime, Integer previewEndTime,
        Boolean isFeatured, String language, String genre, String album, String country, String lrclibId,
        StatusEnum status, Long totalStreams, LocalDateTime createdAt
    ) {
        this(id, title, artistName, duration, songKey, imageKey, videoKey, fullVideoKey,
             previewStartTime, previewEndTime, isFeatured, language, genre, album, country, lrclibId,
             status, null, totalStreams, createdAt, null, null);
    }

    public static SongDto fromEntity(Song song) {
        return fromEntity(song, null, null);
    }

    public static SongDto fromEntity(Song song, Boolean isLiked, Long likesCount) {
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
            song.getCountry() != null ? song.getCountry() : "India",
            song.getLrclibId(),
            song.getStatus(),
            song.getJobId(),
            streams,
            song.getCreatedAt(),
            isLiked,
            likesCount
        );
    }
}

package me.one_org.melody.Dto.Controllers.Api;

import java.time.LocalDateTime;
import me.one_org.melody.Entity.Playlist;
import me.one_org.melody.Enums.StatusEnum;

public record PlaylistDto(
    String id,
    String name,
    String description,
    String coverImageKey,
    String videoKey,
    int totalSongs,
    StatusEnum status,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
    public static PlaylistDto fromEntity(Playlist playlist) {
        if (playlist == null) return null;
        return new PlaylistDto(
            playlist.getId(),
            playlist.getName(),
            playlist.getDescription(),
            playlist.getCoverImageKey(),
            playlist.getVideoKey(),
            playlist.getTotalSongs(),
            playlist.getStatus(),
            playlist.getCreatedAt(),
            playlist.getUpdatedAt()
        );
    }
}

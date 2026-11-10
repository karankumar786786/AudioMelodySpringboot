package me.one_org.melody.Dto.Controllers.Api;

import java.time.LocalDateTime;

public record UserProgressDto(
    String songId,
    Double currentTime,
    Double duration,
    Double progressPercent,
    String contextType,
    String contextId,
    LocalDateTime updatedAt,
    SongDto song
) {}


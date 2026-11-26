package me.one_org.melody.Dto.Controllers.Api;

import java.time.LocalDateTime;

/**
 * User kahan tak suna tha (resume ke liye) - song ki details ke saath.
 */
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


package me.one_org.melody.Dto.Controllers.Api;

import java.time.LocalDateTime;

/**
 * History screen ki ek row: song ki details + kab suna (listenedAt) + kitna suna (part %).
 */
public record UserHistoryResponseDto(
    String historyId,
    String id,
    String title,
    String artistName,
    Integer duration,
    String songKey,
    String imageKey,
    String videoKey,
    String fullVideoKey,
    Boolean isFeatured,
    String language,
    String lrclibId,
    String status,
    LocalDateTime createdAt,
    Integer previewStartTime,
    Integer previewEndTime,
    Integer part,
    LocalDateTime listenedAt,
    Long totalStreams
) {}


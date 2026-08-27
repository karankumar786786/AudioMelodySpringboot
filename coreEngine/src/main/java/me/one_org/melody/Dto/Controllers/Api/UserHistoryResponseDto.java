package me.one_org.melody.Dto.Controllers.Api;

import java.time.LocalDateTime;

public record UserHistoryResponseDto(
    String historyId,
    String id,
    String title,
    String artistName,
    Integer duration,
    String songKey,
    String imageKey,
    String videoKey,
    Boolean isFeatured,
    String language,
    String lrclibId,
    String status,
    LocalDateTime createdAt,
    Integer part,
    LocalDateTime listenedAt
) {}


package me.one_org.melody.Dto.Controllers.User;

import java.time.LocalDateTime;

public record UserSessionDto(
    String id,
    String deviceId,
    LocalDateTime expiresAt,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    boolean isCurrent
) {
}

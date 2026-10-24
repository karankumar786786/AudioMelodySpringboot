package me.one_org.melody.Dto.Controllers.User;

import java.time.LocalDateTime;

public record UserSessionDto(
    String id,
    String deviceId,
    String deviceName,
    String ipAddress,
    LocalDateTime lastActiveAt,
    LocalDateTime expiresAt,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    boolean isCurrent
) {
    public UserSessionDto(String id, String deviceId, LocalDateTime expiresAt,
                          LocalDateTime createdAt, LocalDateTime updatedAt, boolean isCurrent) {
        this(id, deviceId, "Unknown Device", "127.0.0.1", updatedAt, expiresAt, createdAt, updatedAt, isCurrent);
    }
}

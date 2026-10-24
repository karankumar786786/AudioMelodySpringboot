package me.one_org.melody.Dto.Controllers.Authentication;

import jakarta.validation.constraints.NotBlank;

public record LogoutRequestDto(
    String refreshToken,
    @NotBlank(message = "Device ID is required")
    String deviceId,
    Boolean allDevices
) {
    public LogoutRequestDto {
        refreshToken = refreshToken != null ? refreshToken.trim() : null;
        deviceId = deviceId != null ? deviceId.trim() : null;
        allDevices = Boolean.TRUE.equals(allDevices);
    }

    public LogoutRequestDto(String refreshToken, String deviceId) {
        this(refreshToken, deviceId, false);
    }

    public LogoutRequestDto(String deviceId) {
        this(null, deviceId, false);
    }

    public boolean isAllDevices() {
        return Boolean.TRUE.equals(allDevices);
    }
}

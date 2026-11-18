package me.one_org.melody.Dto.Controllers.Authentication;

import jakarta.validation.constraints.NotBlank;

public record WebLogoutRequestDto(
    @NotBlank(message = "Device ID is required")
    String deviceId,
    Boolean allDevices
) {
    public WebLogoutRequestDto {
        deviceId = deviceId != null ? deviceId.trim() : null;
    }

    public boolean isAllDevices() {
        return Boolean.TRUE.equals(allDevices);
    }
}

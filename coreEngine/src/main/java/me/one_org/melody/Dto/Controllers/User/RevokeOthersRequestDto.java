package me.one_org.melody.Dto.Controllers.User;

import jakarta.validation.constraints.NotBlank;

public record RevokeOthersRequestDto(
    @NotBlank(message = "Device ID is required")
    String deviceId
) {
}

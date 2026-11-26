package me.one_org.melody.Dto.Controllers.User;

import jakarta.validation.constraints.NotBlank;

/**
 * Request: is device ko chhod ke baaki sab devices se logout karo.
 */
public record RevokeOthersRequestDto(
    @NotBlank(message = "Device ID is required")
    String deviceId
) {
}

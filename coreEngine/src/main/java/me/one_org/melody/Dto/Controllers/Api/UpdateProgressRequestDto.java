package me.one_org.melody.Dto.Controllers.Api;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Request body: gaana kahan tak suna (currentTime, seconds me), taaki app band karke
 * khole to wahin se resume ho. contextType/contextId = kis playlist/album se chal raha tha.
 */
public record UpdateProgressRequestDto(
    @NotBlank(message = "Song ID is required") String songId,
    @NotNull(message = "Current time is required") @Min(0) Double currentTime,
    Double duration,
    String contextType,
    String contextId
) {}


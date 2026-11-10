package me.one_org.melody.Dto.Controllers.Api;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record UpdateProgressRequestDto(
    @NotBlank(message = "Song ID is required") String songId,
    @NotNull(message = "Current time is required") @Min(0) Double currentTime,
    Double duration,
    String contextType,
    String contextId
) {}


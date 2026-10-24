package me.one_org.melody.Dto.Controllers.Api;

import jakarta.validation.constraints.NotBlank;

public record TrackSearchClickRequestDto(
    @NotBlank(message = "Search click type is required")
    String type,
    @NotBlank(message = "Item ID is required")
    String id,
    String query
) {
}

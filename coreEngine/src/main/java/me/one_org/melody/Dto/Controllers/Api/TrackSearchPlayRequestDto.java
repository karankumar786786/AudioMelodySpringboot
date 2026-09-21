package me.one_org.melody.Dto.Controllers.Api;

import jakarta.validation.constraints.NotBlank;

/**
 * Sent by the frontend when a user starts playing a song that came from a search result.
 * Used to track strong intent signals in Recombee (search → play = very high interest).
 */
public record TrackSearchPlayRequestDto(
    @NotBlank String songId
) {
}

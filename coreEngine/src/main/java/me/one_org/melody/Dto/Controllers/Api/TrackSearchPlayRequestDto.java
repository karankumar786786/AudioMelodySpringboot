package me.one_org.melody.Dto.Controllers.Api;

import jakarta.validation.constraints.NotBlank;

/**
 * Jab user search result se koi gaana chalata hai tab app ye bhejta hai.
 * Search karke play karna = user ko us gaane me bahut interest hai, ye strong signal Recombee ko jaata hai.
 */
public record TrackSearchPlayRequestDto(
    @NotBlank String songId,
    String query
) {
}

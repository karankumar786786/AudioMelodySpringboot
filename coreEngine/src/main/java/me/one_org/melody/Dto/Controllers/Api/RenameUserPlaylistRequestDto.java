package me.one_org.melody.Dto.Controllers.Api;

import jakarta.validation.constraints.NotBlank;

/**
 * Request body: playlist ka naya naam.
 */
public record RenameUserPlaylistRequestDto(
    @NotBlank String name
) {
}

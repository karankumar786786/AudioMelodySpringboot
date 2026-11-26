package me.one_org.melody.Dto.Controllers.Api;

import jakarta.validation.constraints.NotBlank;

/**
 * Request body: user ki playlist me ye song jodo.
 */
public record AddSongToUserPlaylistRequestDto(
    @NotBlank String songId
) {
}

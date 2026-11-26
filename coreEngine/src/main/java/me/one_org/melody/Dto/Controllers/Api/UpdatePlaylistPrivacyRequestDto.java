package me.one_org.melody.Dto.Controllers.Api;

import jakarta.validation.constraints.NotNull;
import me.one_org.melody.Enums.PlaylistPrivacyEnum;

/**
 * Request body: playlist ki privacy badlo.
 */
public record UpdatePlaylistPrivacyRequestDto(
    @NotNull(message = "Privacy cannot be null") PlaylistPrivacyEnum privacy
) {
}

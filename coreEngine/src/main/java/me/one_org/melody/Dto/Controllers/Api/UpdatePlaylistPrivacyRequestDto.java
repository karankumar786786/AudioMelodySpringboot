package me.one_org.melody.Dto.Controllers.Api;

import jakarta.validation.constraints.NotNull;
import me.one_org.melody.Enums.PlaylistPrivacyEnum;

public record UpdatePlaylistPrivacyRequestDto(
    @NotNull(message = "Privacy cannot be null") PlaylistPrivacyEnum privacy
) {
}

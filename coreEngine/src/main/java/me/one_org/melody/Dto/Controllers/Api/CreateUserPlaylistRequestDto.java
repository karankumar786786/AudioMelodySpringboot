package me.one_org.melody.Dto.Controllers.Api;

import jakarta.validation.constraints.NotBlank;
import me.one_org.melody.Enums.PlaylistPrivacyEnum;

public record CreateUserPlaylistRequestDto(
    @NotBlank String name,
    PlaylistPrivacyEnum privacy
) {
}

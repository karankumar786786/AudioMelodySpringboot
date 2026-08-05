package me.one_org.melody.Dto.Controllers.Api;

import jakarta.validation.constraints.NotBlank;

public record AddSongToUserPlaylistRequestDto(
    @NotBlank String songId
) {
}

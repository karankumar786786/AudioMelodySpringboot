package me.one_org.melody.Dto.Controllers.Admin;

import jakarta.validation.constraints.NotBlank;

public record ReprocessAudioRequestDto(
        @NotBlank(message = "tempSongKey is required")
        String tempSongKey,
        String tempVideoKey
) {
}

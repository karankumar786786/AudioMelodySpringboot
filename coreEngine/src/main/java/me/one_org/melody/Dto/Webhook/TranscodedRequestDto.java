package me.one_org.melody.Dto.Webhook;

import jakarta.validation.constraints.NotBlank;

public record TranscodedRequestDto(
    @NotBlank String songKey,
    Integer duration,
    String fullVideoKey,
    String videoKey
) {
}

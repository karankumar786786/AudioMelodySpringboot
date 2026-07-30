package me.one_org.melody.Dto.Webhook;

import jakarta.validation.constraints.NotBlank;

public record JobStartedRequestDto(
    @NotBlank String processingId
) {
}

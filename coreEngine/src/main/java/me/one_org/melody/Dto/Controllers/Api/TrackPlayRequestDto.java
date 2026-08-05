package me.one_org.melody.Dto.Controllers.Api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;

public record TrackPlayRequestDto(
    @NotBlank String songId,
    @DecimalMin("0.0") @DecimalMax("1.0") double percentage
) {
}

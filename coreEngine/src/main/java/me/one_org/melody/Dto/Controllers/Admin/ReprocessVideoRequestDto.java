package me.one_org.melody.Dto.Controllers.Admin;

import jakarta.validation.constraints.NotBlank;

public record ReprocessVideoRequestDto(
    @NotBlank String tempVideoKey
) {
}

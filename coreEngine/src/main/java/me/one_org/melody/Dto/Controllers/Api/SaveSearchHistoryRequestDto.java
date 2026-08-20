package me.one_org.melody.Dto.Controllers.Api;

import jakarta.validation.constraints.NotBlank;

public record SaveSearchHistoryRequestDto(
    @NotBlank(message = "searchText is required")
    String searchText
) {}

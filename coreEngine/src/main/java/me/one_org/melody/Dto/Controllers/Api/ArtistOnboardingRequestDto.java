package me.one_org.melody.Dto.Controllers.Api;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record ArtistOnboardingRequestDto(
    @NotEmpty(message = "Artist selection cannot be empty")
    @Size(min = 1, max = 15, message = "Please select between 1 and 15 artists")
    List<String> artistIds
) {}

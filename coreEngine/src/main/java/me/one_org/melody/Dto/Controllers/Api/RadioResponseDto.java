package me.one_org.melody.Dto.Controllers.Api;

import java.util.List;

public record RadioResponseDto(
    List<SongDto> songs,
    String recommId
) {}

package me.one_org.melody.Dto.Queue;

public record JobCleanupRequestDto(
    String songId,
    String tempSongKey,
    String tempVideoKey,
    String songKey,
    String fullVideoKey
) {}

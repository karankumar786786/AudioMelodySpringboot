package me.one_org.melody.Dto.Controllers.Api;

public record LyricsDto(
    String songId,
    String lrclibId,
    String trackName,
    String artistName,
    Double duration,
    Boolean instrumental,
    String plainLyrics,
    String syncedLyrics
) {}


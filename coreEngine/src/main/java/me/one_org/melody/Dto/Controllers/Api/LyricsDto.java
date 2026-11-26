package me.one_org.melody.Dto.Controllers.Api;

/**
 * Gaane ke lyrics (lrclib.net se): plain text aur synced (time ke saath, karaoke jaisa).
 */
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


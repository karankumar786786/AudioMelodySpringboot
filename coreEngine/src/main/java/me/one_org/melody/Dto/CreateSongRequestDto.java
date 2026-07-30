package me.one_org.melody.Dto;

public record CreateSongRequestDto(
    String title,
    String artistName,
    String duration,
    String songTempKey,
    String imageTempKey
) {
    
}

package me.one_org.melody.Dto.Controllers.Admin;

public record CreateSongRequestDto(
    String title,
    String artistName,
    String duration,
    String songTempKey,
    String imageTempKey
) {
    
}

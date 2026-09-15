package me.one_org.melody.Dto.Controllers.Admin;

public record RecoverSongMediaRequestDto(
        String tempSongKey,
        String tempVideoKey,
        Integer clipStartMin,
        Integer clipStartSec,
        Integer clipEndMin,
        Integer clipEndSec
) {
}

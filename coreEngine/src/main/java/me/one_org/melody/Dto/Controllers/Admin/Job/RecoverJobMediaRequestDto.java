package me.one_org.melody.Dto.Controllers.Admin.Job;

public record RecoverJobMediaRequestDto(
        String tempSongKey,
        String tempVideoKey,
        Integer clipStartMin,
        Integer clipStartSec,
        Integer clipEndMin,
        Integer clipEndSec
) {
}

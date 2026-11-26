package me.one_org.melody.Dto.Controllers.Api;

import java.util.List;

/**
 * Radio (ek gaane jaise aur gaane) ka jawab: songs ki list + Recombee ka recommId
 * (recommId wapas bhejte hain taaki Recombee jaane ki user ne uska kaunsa suggestion suna).
 */
public record RadioResponseDto(
    List<SongDto> songs,
    String recommId
) {}

package me.one_org.melody.Dto.Controllers;

public record AlbumDto(
    String name,
    String artistName,
    long trackCount,
    String imageKey,
    String genre
) {}

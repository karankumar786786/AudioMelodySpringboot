package me.one_org.melody.Dto.Controllers;

/**
 * Ek album ka summary (album ka alag table nahi hai - songs ko album naam se group karke banta hai):
 * naam, artist, kitne tracks, cover image aur genre.
 */
public record AlbumDto(
    String name,
    String artistName,
    long trackCount,
    String imageKey,
    String genre
) {}

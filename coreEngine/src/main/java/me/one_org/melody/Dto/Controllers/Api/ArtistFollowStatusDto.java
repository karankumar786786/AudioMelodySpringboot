package me.one_org.melody.Dto.Controllers.Api;

/**
 * Artist ke page ke liye: kitne followers hain aur kya ye user follow karta hai.
 */
public record ArtistFollowStatusDto(
    String artistId,
    String artistName,
    Long followersCount,
    Boolean isFollowing
) {}

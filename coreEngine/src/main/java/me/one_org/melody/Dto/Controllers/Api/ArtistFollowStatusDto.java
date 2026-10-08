package me.one_org.melody.Dto.Controllers.Api;

public record ArtistFollowStatusDto(
    String artistId,
    String artistName,
    Long followersCount,
    Boolean isFollowing
) {}

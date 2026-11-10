package me.one_org.melody.Dto.Controllers.Api;

public record ShortsLikeStatusDto(
        String songId,
        boolean isLiked,
        long count
) {}

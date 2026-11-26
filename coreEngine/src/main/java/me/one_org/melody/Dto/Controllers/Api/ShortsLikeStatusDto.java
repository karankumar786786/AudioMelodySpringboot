package me.one_org.melody.Dto.Controllers.Api;

/**
 * PURANE canvas-shorts ka like status: like kiya hai ya nahi, aur total likes.
 */
public record ShortsLikeStatusDto(
        String songId,
        boolean isLiked,
        long count
) {}


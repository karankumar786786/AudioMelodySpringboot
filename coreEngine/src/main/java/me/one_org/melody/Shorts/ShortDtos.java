package me.one_org.melody.Shorts;

import java.time.OffsetDateTime;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

/** Request and response shapes for /api/shorts. */
public final class ShortDtos {

    private ShortDtos() {}

    public record Owner(String type, String userId, String userName) {}

    public record LinkedSong(String id, String title, String artistName, String imageKey, String songKey, Integer duration) {}

    /** One short. hlsKey and thumbnailKey are S3 keys; clients build URLs like they do for songs. */
    public record Short(
            String id,
            String caption,
            String status,
            String hlsKey,
            String thumbnailKey,
            Integer durationMs,
            Integer width,
            Integer height,
            long likesCount,
            long viewsCount,
            boolean liked,
            boolean mine,
            Owner owner,
            LinkedSong song,
            /** Only shown to the owner. */
            String failureReason,
            OffsetDateTime publishedAt,
            OffsetDateTime createdAt) {}

    /** A page of shorts; pass nextCursor back to get the next page (null = no more). */
    public record Page(List<Short> items, String nextCursor) {}

    public record UploadRequest(
            @NotBlank String contentType,
            @Min(1) long sizeBytes,
            @Size(max = 300) String caption,
            String songId) {}

    public record UploadResponse(String shortId, String uploadUrl, String method, String contentType, long expiresInSeconds) {}

    public record UpdateRequest(@Size(max = 300) String caption, String songId, Boolean clearSong) {}

    public record ReportRequest(@NotBlank String reason, @Size(max = 500) String note) {}

    public record LikeStatus(String shortId, boolean liked, long likesCount) {}

    public record ViewBatch(@NotEmpty @Size(max = 50) List<@Valid View> views) {
        public record View(@NotBlank String shortId, @Min(0) @Max(600_000) long watchedMs) {}
    }
}

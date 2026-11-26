package me.one_org.melody.Shorts;

import java.time.OffsetDateTime;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

/** /api/shorts ke saare request aur response ke shapes (records) ek jagah. */
public final class ShortDtos {

    private ShortDtos() {}

    /** Short kisne daala: type (ADMIN / USER), user id aur naam. */
    public record Owner(String type, String userId, String userName) {}

    /** Short se juda gaana (tap karke poora gaana sun sakte hain). */
    public record LinkedSong(String id, String title, String artistName, String imageKey, String songKey, Integer duration) {}

    /** Ek short. hlsKey aur thumbnailKey S3 keys hain; app unse URL waise hi banata hai jaise songs ke liye. */
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
            /** Sirf owner ko dikhta hai (processing fail kyun hua). */
            String failureReason,
            OffsetDateTime publishedAt,
            OffsetDateTime createdAt) {}

    /** Shorts ka ek page. Agle page ke liye nextCursor wapas bhejo (null = aur nahi hain). */
    public record Page(List<Short> items, String nextCursor) {}

    /** Upload shuru karne ki request: content type (MP4/MOV), size, caption, optional song. */
    public record UploadRequest(
            @NotBlank String contentType,
            @Min(1) long sizeBytes,
            @Size(max = 300) String caption,
            String songId) {}

    /** Upload ka jawab: short id + presigned PUT URL (kitni der valid). */
    public record UploadResponse(String shortId, String uploadUrl, String method, String contentType, long expiresInSeconds) {}

    /** Caption / linked song badlo. clearSong = true to song hatao. */
    public record UpdateRequest(@Size(max = 300) String caption, String songId, Boolean clearSong) {}

    /** Report: wajah aur optional note. */
    public record ReportRequest(@NotBlank String reason, @Size(max = 500) String note) {}

    /** Like hai ya nahi + total likes. */
    public record LikeStatus(String shortId, boolean liked, long likesCount) {}

    /** Ek saath kai views (max 50): kaunsa short, kitne ms dekha (max 10 minute). */
    public record ViewBatch(@NotEmpty @Size(max = 50) List<@Valid View> views) {
        public record View(@NotBlank String shortId, @Min(0) @Max(600_000) long watchedMs) {}
    }
}

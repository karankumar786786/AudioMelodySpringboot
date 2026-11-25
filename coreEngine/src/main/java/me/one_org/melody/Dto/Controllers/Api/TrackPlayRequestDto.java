package me.one_org.melody.Dto.Controllers.Api;

import java.util.List;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;

/**
 * One listen. Everything after {@code durationMs} is optional listening detail used for
 * song analytics (heatmap, drop-off, delivery quality); older clients omit it.
 */
public record TrackPlayRequestDto(
    @NotBlank String songId,
    @DecimalMin("0.0") @DecimalMax("1.0") double percentage,
    /** Optional track length; lets the stream services apply the 30-second rule without a lookup. */
    Long durationMs,
    /** Parts actually played, [[startMs, endMs], …] in track time. */
    List<List<Long>> ranges,
    /** Position where listening stopped. */
    Long exitMs,
    /** The skip button ended this listen. */
    Boolean skipped,
    /** Seeks during the listen, [[fromMs, toMs], …]. */
    List<List<Long>> seeks,
    /** 128kbps | 240kbps | 320kbps | auto */
    String quality,
    /** ios | android | web */
    String platform,
    Long startupMs,
    Integer rebufferCount,
    Long rebufferMs
) {
    public TrackPlayRequestDto(String songId, double percentage) {
        this(songId, percentage, null);
    }

    public TrackPlayRequestDto(String songId, double percentage, Long durationMs) {
        this(songId, percentage, durationMs, null, null, null, null, null, null, null, null, null);
    }
}

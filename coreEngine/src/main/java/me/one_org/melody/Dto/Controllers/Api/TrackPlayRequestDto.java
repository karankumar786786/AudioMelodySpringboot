package me.one_org.melody.Dto.Controllers.Api;

import java.util.List;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;

/**
 * Ek listen (gaana suna) ki report.
 * {@code durationMs} ke baad ki saari fields optional hain - ye song analytics ke liye hain
 * (heatmap: gaane ka kaunsa hissa zyada suna, kahan chhoda, streaming quality).
 * Purane app versions ye nahi bhejte, aur wo bhi chalna chahiye.
 */
public record TrackPlayRequestDto(
    @NotBlank String songId,
    @DecimalMin("0.0") @DecimalMax("1.0") double percentage,
    /** Gaane ki length (optional). Isse "30 second sune to stream count" rule bina DB lookup ke lag jaata hai. */
    Long durationMs,
    /** Gaane ke kaunse hisse sach me baje: [[startMs, endMs], ...]. */
    List<List<Long>> ranges,
    /** Sunna kahan pe ruka. */
    Long exitMs,
    /** Skip button dabane se listen khatam hua? */
    Boolean skipped,
    /** Beech me aage/peeche kiya (seek): [[fromMs, toMs], ...]. */
    List<List<Long>> seeks,
    /** Kis quality me baja: 128kbps | 240kbps | 320kbps | auto */
    String quality,
    /** Kis platform se: ios | android | web */
    String platform,
    Long startupMs, // play dabane se awaaz aane tak kitne ms lage
    Integer rebufferCount, // kitni baar buffering ki wajah se ruka
    Long rebufferMs // buffering me kul kitna time gaya
) {
    public TrackPlayRequestDto(String songId, double percentage) {
        this(songId, percentage, null);
    }

    public TrackPlayRequestDto(String songId, double percentage, Long durationMs) {
        this(songId, percentage, durationMs, null, null, null, null, null, null, null, null, null);
    }
}

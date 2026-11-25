package me.one_org.melody.Events.Kafka;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import me.one_org.melody.Exceptions.BadRequestException;
import me.oneorg.melody.events.ListenRange;
import me.oneorg.melody.events.SeekMove;

/**
 * Optional listening detail sent with a play: which parts were played, seeks, skip and
 * exit position, the quality used and delivery health. Validated and normalised here so
 * the analytics stream only sees clean, merged ranges in track time.
 */
public record ListenDetail(
        List<ListenRange> ranges,
        Long exitMs,
        boolean skipped,
        List<SeekMove> seeks,
        String quality,
        String platform,
        Long startupMs,
        int rebufferCount,
        long rebufferMs) {

    public static final ListenDetail EMPTY = new ListenDetail(List.of(), null, false, List.of(), null, null, null, 0, 0);

    static final int MAX_RANGES = 200;
    static final int MAX_SEEKS = 100;
    /** Longest track position we accept (3 hours), whatever the client claims. */
    static final long MAX_POSITION_MS = 3L * 60 * 60 * 1000;
    static final Set<String> QUALITIES = Set.of("128kbps", "240kbps", "320kbps", "auto");
    static final Set<String> PLATFORMS = Set.of("ios", "android", "web");

    /**
     * Builds a detail from the raw request fields. {@code rawRanges} and {@code rawSeeks}
     * are [[a, b], …] pairs. Ranges are clamped to the track, sorted and merged.
     */
    public static ListenDetail of(List<List<Long>> rawRanges, Long exitMs, Boolean skipped, List<List<Long>> rawSeeks,
                                  String quality, String platform, Long startupMs, Integer rebufferCount,
                                  Long rebufferMs, Long durationMs) {
        long limit = durationMs != null && durationMs > 0 ? Math.min(durationMs, MAX_POSITION_MS) : MAX_POSITION_MS;
        List<ListenRange> ranges = mergeRanges(pairs(rawRanges, MAX_RANGES, "ranges"), limit);
        List<SeekMove> seeks = new ArrayList<>();
        for (long[] p : pairs(rawSeeks, MAX_SEEKS, "seeks")) {
            seeks.add(SeekMove.newBuilder().setFromMs(Math.min(p[0], limit)).setToMs(Math.min(p[1], limit)).build());
        }
        return new ListenDetail(
                ranges,
                exitMs == null ? null : clamp(exitMs, 0, limit, "exitMs"),
                Boolean.TRUE.equals(skipped),
                seeks,
                pick(quality, QUALITIES, "quality"),
                pick(platform, PLATFORMS, "platform"),
                startupMs == null ? null : clamp(startupMs, 0, 120_000, "startupMs"),
                rebufferCount == null ? 0 : (int) clamp(rebufferCount, 0, 10_000, "rebufferCount"),
                rebufferMs == null ? 0 : clamp(rebufferMs, 0, MAX_POSITION_MS, "rebufferMs"));
    }

    private static List<long[]> pairs(List<List<Long>> raw, int max, String field) {
        if (raw == null) return List.of();
        if (raw.size() > max) throw new BadRequestException("At most " + max + " " + field + " per play");
        List<long[]> out = new ArrayList<>(raw.size());
        for (List<Long> p : raw) {
            if (p == null || p.size() != 2 || p.get(0) == null || p.get(1) == null) {
                throw new BadRequestException(field + " must be [start, end] pairs");
            }
            long a = p.get(0);
            long b = p.get(1);
            if (a < 0 || b < 0) throw new BadRequestException(field + " can't be negative");
            out.add(new long[] {a, b});
        }
        return out;
    }

    /** Pure: clamp to [0, limit], drop empty or reversed ranges, sort and merge overlaps. */
    static List<ListenRange> mergeRanges(List<long[]> raw, long limit) {
        List<long[]> cleaned = new ArrayList<>();
        for (long[] r : raw) {
            long start = Math.min(r[0], limit);
            long end = Math.min(r[1], limit);
            if (end > start) cleaned.add(new long[] {start, end});
        }
        cleaned.sort(Comparator.comparingLong(r -> r[0]));
        List<ListenRange> merged = new ArrayList<>();
        long curStart = -1;
        long curEnd = -1;
        for (long[] r : cleaned) {
            if (curStart < 0) {
                curStart = r[0];
                curEnd = r[1];
            } else if (r[0] <= curEnd) {
                curEnd = Math.max(curEnd, r[1]);
            } else {
                merged.add(ListenRange.newBuilder().setStartMs(curStart).setEndMs(curEnd).build());
                curStart = r[0];
                curEnd = r[1];
            }
        }
        if (curStart >= 0) merged.add(ListenRange.newBuilder().setStartMs(curStart).setEndMs(curEnd).build());
        return merged;
    }

    private static long clamp(long v, long min, long max, String field) {
        if (v < min) throw new BadRequestException(field + " can't be negative");
        return Math.min(v, max);
    }

    private static String pick(String value, Set<String> allowed, String field) {
        if (value == null || value.isBlank()) return null;
        String v = value.trim().toLowerCase(Locale.ROOT);
        if (!allowed.contains(v)) throw new BadRequestException("Unknown " + field + ": " + value);
        return v;
    }
}

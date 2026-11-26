package me.one_org.melody.Shorts;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;

import me.one_org.melody.Exceptions.BadRequestException;

/**
 * Feed ka "cursor" (next page kahan se shuru ho) - app ke liye ek band dabba (opaque string).
 * - "latest" feed: (published_at, id) se - beech me naye shorts aa jaayein to bhi pages khiskte nahi.
 * - Ranked feeds (foryou / popular): offset (kitne items chhod ke) se.
 * String me Base64 karke bhejte hain.
 */
public record ShortCursor(Instant publishedAt, String id, int offset) {

    /** Pehla page (koi cursor nahi). */
    public static final ShortCursor START = new ShortCursor(null, null, 0);

    /** Time wala cursor hai (latest feed)? Nahi to offset wala. */
    public boolean isTimeCursor() {
        return publishedAt != null && id != null;
    }

    /** Time wala cursor banao. */
    public static ShortCursor time(Instant publishedAt, String id) {
        return new ShortCursor(publishedAt, id, 0);
    }

    /** Offset wala cursor banao. */
    public static ShortCursor offset(int offset) {
        return new ShortCursor(null, null, offset);
    }

    /** Cursor -> string: "t:<millis>:<id>" ya "o:<offset>", phir URL-safe Base64. */
    public String encode() {
        String raw = isTimeCursor() ? "t:" + publishedAt.toEpochMilli() + ":" + id : "o:" + offset;
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    /** String -> cursor. Khaali ho to START. Galat ho (ya offset 10,000 se zyada) to 400. */
    public static ShortCursor decode(String cursor) {
        if (cursor == null || cursor.isBlank()) return START;
        try {
            String raw = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
            if (raw.startsWith("t:")) {
                int sep = raw.indexOf(':', 2);
                return time(Instant.ofEpochMilli(Long.parseLong(raw.substring(2, sep))), raw.substring(sep + 1));
            }
            if (raw.startsWith("o:")) {
                int offset = Integer.parseInt(raw.substring(2));
                if (offset < 0 || offset > 10_000) throw new NumberFormatException();
                return offset(offset);
            }
        } catch (RuntimeException ignored) {
            // Cursor kharab hai - neeche 400 error phenkte hain
        }
        throw new BadRequestException("Invalid cursor");
    }
}

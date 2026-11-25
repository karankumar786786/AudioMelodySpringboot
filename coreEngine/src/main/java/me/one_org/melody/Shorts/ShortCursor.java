package me.one_org.melody.Shorts;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;

import me.one_org.melody.Exceptions.BadRequestException;

/**
 * Opaque feed cursor. "latest" pages by (published_at, id) so new shorts don't shift
 * pages; ranked feeds page by offset.
 */
public record ShortCursor(Instant publishedAt, String id, int offset) {

    public static final ShortCursor START = new ShortCursor(null, null, 0);

    public boolean isTimeCursor() {
        return publishedAt != null && id != null;
    }

    public static ShortCursor time(Instant publishedAt, String id) {
        return new ShortCursor(publishedAt, id, 0);
    }

    public static ShortCursor offset(int offset) {
        return new ShortCursor(null, null, offset);
    }

    public String encode() {
        String raw = isTimeCursor() ? "t:" + publishedAt.toEpochMilli() + ":" + id : "o:" + offset;
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

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
            // fall through
        }
        throw new BadRequestException("Invalid cursor");
    }
}

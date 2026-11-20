package me.oneorg.melody.events;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.UUID;
import java.util.regex.Pattern;

/** UUID v7 (RFC 9562): time-ordered, so event ids sort roughly by creation time. */
public final class EventIds {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Pattern UUID_PATTERN =
            Pattern.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");

    private EventIds() {}

    public static String newId() {
        return newId(System.currentTimeMillis());
    }

    static String newId(long epochMillis) {
        byte[] random = new byte[10];
        RANDOM.nextBytes(random);
        long msb = (epochMillis & 0xFFFF_FFFF_FFFFL) << 16;
        msb |= 0x7000L;                                   // version 7
        msb |= ((random[0] & 0x0FL) << 8) | (random[1] & 0xFFL);
        long lsb = 0;
        for (int i = 2; i < 10; i++) {
            lsb = (lsb << 8) | (random[i] & 0xFFL);
        }
        lsb = (lsb & 0x3FFF_FFFF_FFFF_FFFFL) | 0x8000_0000_0000_0000L; // IETF variant
        return new UUID(msb, lsb).toString();
    }

    /** True for any well-formed UUID string; clients may send v4 or v7. */
    public static boolean isValid(String id) {
        return id != null && UUID_PATTERN.matcher(id).matches();
    }

    public static EventMeta meta(String eventId, Instant occurredAt, Instant receivedAt, String source) {
        return EventMeta.newBuilder()
                .setEventId(eventId)
                .setOccurredAt(occurredAt)
                .setReceivedAt(receivedAt)
                .setSource(source)
                .build();
    }

    public static EventMeta serverMeta(String source) {
        Instant now = Instant.now();
        return meta(newId(now.toEpochMilli()), now, now, source);
    }
}

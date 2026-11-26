package me.oneorg.melody.events;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.UUID;
import java.util.regex.Pattern;

/** UUID v7 (RFC 9562): time ke order wale ids, isliye event ids lagbhag banne ke time se sort hote hain. */
public final class EventIds {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Pattern UUID_PATTERN =
            Pattern.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");

    private EventIds() {}

    /** Naya event id (UUID v7, abhi ke time se). */
    public static String newId() {
        return newId(System.currentTimeMillis());
    }

    /** Diye gaye time se UUID v7: pehle 48 bits = time (ms), baaki random. */
    static String newId(long epochMillis) {
        byte[] random = new byte[10];
        RANDOM.nextBytes(random);
        long msb = (epochMillis & 0xFFFF_FFFF_FFFFL) << 16;
        msb |= 0x7000L;                                   // version 7 wale bits set karo
        msb |= ((random[0] & 0x0FL) << 8) | (random[1] & 0xFFL);
        long lsb = 0;
        for (int i = 2; i < 10; i++) {
            lsb = (lsb << 8) | (random[i] & 0xFFL);
        }
        lsb = (lsb & 0x3FFF_FFFF_FFFF_FFFFL) | 0x8000_0000_0000_0000L; // IETF variant wale bits set karo
        return new UUID(msb, lsb).toString();
    }

    /** Koi bhi sahi UUID string ho to true; apps v4 ya v7 bhej sakte hain. */
    public static boolean isValid(String id) {
        return id != null && UUID_PATTERN.matcher(id).matches();
    }

    /** EventMeta banao: event id, kab hua, server pe kab mila, kisne bheja (source). */
    public static EventMeta meta(String eventId, Instant occurredAt, Instant receivedAt, String source) {
        return EventMeta.newBuilder()
                .setEventId(eventId)
                .setOccurredAt(occurredAt)
                .setReceivedAt(receivedAt)
                .setSource(source)
                .build();
    }

    /** Server ka khud ka event: nayi id, aur dono time = abhi. */
    public static EventMeta serverMeta(String source) {
        Instant now = Instant.now();
        return meta(newId(now.toEpochMilli()), now, now, source);
    }
}

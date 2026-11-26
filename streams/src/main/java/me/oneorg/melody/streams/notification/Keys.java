package me.oneorg.melody.streams.notification;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

/**
 * Kafka keys banane ka helper.
 */
final class Keys {
    private Keys() {}

    /** Wahi key jo core aur admin API use karte hain: email (lowercase) ka SHA-256 hash. */
    static String addressKey(String email) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(email.trim().toLowerCase().getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}

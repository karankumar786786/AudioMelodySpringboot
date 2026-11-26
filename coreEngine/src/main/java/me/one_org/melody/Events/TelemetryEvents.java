package me.one_org.melody.Events;

import java.util.List;

/**
 * User activity ke events (data holder records): follow, play, favourite, playlist, onboarding, register, login.
 * Services inhe publishEvent() se bhejti hain. Inhe do jagah suna jaata hai:
 * - TelemetryEventListener (LEGACY/DUAL: seedha Recombee/Algolia)
 * - OutboxEventBridge (DUAL/KAFKA: outbox row -> Kafka)
 */
public final class TelemetryEvents {

    private TelemetryEvents() {}

    public record ArtistFollowEvent(String userId, String artistId) {}

    public record ArtistUnfollowEvent(String userId, String artistId) {}

    public record SongPlayEvent(String userId, String songId, double percentage) {}

    public record SongFavouriteEvent(String userId, String songId, boolean isAdd) {}

    public record PlaylistSongEvent(String userId, String songId, boolean isAdd) {}

    public record OnboardingSeededEvent(String userId, List<String> followedArtistIds) {}

    public record UserRegisteredEvent(String userId) {}

    public record UserLoginEvent(String userId, String email, String deviceId, String deviceName, String ipAddress, String location) {
        public UserLoginEvent(String userId, String email, String deviceId, String deviceName, String ipAddress) {
            this(userId, email, deviceId, deviceName, ipAddress, "Unknown Location");
        }
    }
}

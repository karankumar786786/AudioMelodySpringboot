package me.one_org.melody.Events;

import java.util.List;

public final class TelemetryEvents {

    private TelemetryEvents() {}

    public record ArtistFollowEvent(String userId, String artistId) {}

    public record ArtistUnfollowEvent(String userId, String artistId) {}

    public record SongPlayEvent(String userId, String songId, double percentage) {}

    public record SongFavouriteEvent(String userId, String songId, boolean isAdd) {}

    public record PlaylistSongEvent(String userId, String songId, boolean isAdd) {}

    public record OnboardingSeededEvent(String userId, List<String> followedArtistIds) {}

    public record UserRegisteredEvent(String userId) {}
}

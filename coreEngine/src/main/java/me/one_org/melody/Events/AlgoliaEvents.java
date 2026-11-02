package me.one_org.melody.Events;

import me.one_org.melody.Enums.PlaylistPrivacyEnum;

public final class AlgoliaEvents {

    private AlgoliaEvents() {}

    public record PlaylistIndexSyncEvent(String playlistId, String name) {}

    public record UserPlaylistIndexSyncEvent(
            String playlistId,
            String name,
            PlaylistPrivacyEnum privacy,
            String shareToken,
            int totalSongs,
            String ownerId,
            String ownerName
    ) {}

    public record PlaylistIndexDeleteEvent(String playlistId) {}

    public record SongIndexSyncEvent(String songId) {}

    public record SongIndexDeleteEvent(String songId) {}
}


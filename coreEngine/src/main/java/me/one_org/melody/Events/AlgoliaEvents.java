package me.one_org.melody.Events;

import me.one_org.melody.Enums.PlaylistPrivacyEnum;

/**
 * Algolia sync ke events (sirf data holder records).
 * Services inhe publishEvent() se bhejti hain, AlgoliaEventListener inhe sunta hai.
 */
public final class AlgoliaEvents {

    private AlgoliaEvents() {}

    /** Official playlist search me save/update karo. */
    public record PlaylistIndexSyncEvent(String playlistId, String name) {}

    /** User playlist search me save karo ya (private ho to) hatao. */
    public record UserPlaylistIndexSyncEvent(
            String playlistId,
            String name,
            PlaylistPrivacyEnum privacy,
            String shareToken,
            int totalSongs,
            String ownerId,
            String ownerName
    ) {}

    /** Playlist search se hatao. */
    public record PlaylistIndexDeleteEvent(String playlistId) {}

    /** Song search me save karo. */
    public record SongIndexSyncEvent(String songId) {}

    /** Song search se hatao. */
    public record SongIndexDeleteEvent(String songId) {}
}


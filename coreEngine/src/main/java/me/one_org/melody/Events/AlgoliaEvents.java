package me.one_org.melody.Events;

public final class AlgoliaEvents {

    private AlgoliaEvents() {}

    public record PlaylistIndexSyncEvent(String playlistId, String name) {}

    public record PlaylistIndexDeleteEvent(String playlistId) {}
}

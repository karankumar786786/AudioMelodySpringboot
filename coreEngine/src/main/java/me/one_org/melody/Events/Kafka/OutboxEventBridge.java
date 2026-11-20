package me.one_org.melody.Events.Kafka;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import me.one_org.melody.Events.TelemetryEvents;
import me.oneorg.melody.events.Topics;

/**
 * Turns the services' existing state-change events into outbox rows. BEFORE_COMMIT runs
 * inside the same transaction, so the row is committed together with the change (or
 * not at all). The services' code is unchanged.
 */
@Component
public class OutboxEventBridge {

    private final OutboxWriter outbox;
    private final EventsProperties properties;

    public OutboxEventBridge(OutboxWriter outbox, EventsProperties properties) {
        this.outbox = outbox;
        this.properties = properties;
    }

    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT, fallbackExecution = true)
    public void onFavourite(TelemetryEvents.SongFavouriteEvent e) {
        if (!enabled()) return;
        outbox.write(Topics.FAVOURITE, e.userId(), map(
                "user_id", e.userId(), "song_id", e.songId(), "added", e.isAdd()));
    }

    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT, fallbackExecution = true)
    public void onPlaylistSong(TelemetryEvents.PlaylistSongEvent e) {
        if (!enabled()) return;
        outbox.write(Topics.PLAYLIST_SONG, e.userId(), map(
                "user_id", e.userId(), "song_id", e.songId(), "added", e.isAdd()));
    }

    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT, fallbackExecution = true)
    public void onFollow(TelemetryEvents.ArtistFollowEvent e) {
        if (!enabled()) return;
        outbox.write(Topics.ARTIST_FOLLOW, e.userId(), map(
                "user_id", e.userId(), "artist_id", e.artistId(), "followed", true));
    }

    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT, fallbackExecution = true)
    public void onUnfollow(TelemetryEvents.ArtistUnfollowEvent e) {
        if (!enabled()) return;
        outbox.write(Topics.ARTIST_FOLLOW, e.userId(), map(
                "user_id", e.userId(), "artist_id", e.artistId(), "followed", false));
    }

    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT, fallbackExecution = true)
    public void onRegistered(TelemetryEvents.UserRegisteredEvent e) {
        if (!enabled()) return;
        outbox.write(Topics.USER_LIFECYCLE, e.userId(), map(
                "user_id", e.userId(), "type", "SIGNED_UP", "followed_artist_ids", List.of()));
    }

    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT, fallbackExecution = true)
    public void onOnboarded(TelemetryEvents.OnboardingSeededEvent e) {
        if (!enabled()) return;
        List<String> artists = e.followedArtistIds() == null ? List.of() : e.followedArtistIds();
        outbox.write(Topics.USER_LIFECYCLE, e.userId(), map(
                "user_id", e.userId(), "type", "ONBOARDED", "followed_artist_ids", artists));
    }

    private boolean enabled() {
        return properties.mode().producesEvents();
    }

    private static Map<String, Object> map(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
        return m;
    }
}

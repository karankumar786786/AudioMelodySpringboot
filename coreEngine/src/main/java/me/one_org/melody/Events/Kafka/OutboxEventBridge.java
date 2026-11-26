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
 * Services ke state-change events (favourite, playlist, follow, register...) ko outbox rows me badalta hai.
 *
 * OUTBOX PATTERN: data change aur "event" dono ek hi DB transaction me likho. Baad me ek
 * alag process (streams/ ka outboxRelay) outbox table padh ke event Kafka pe bhejta hai.
 * Isse ye nahi ho sakta ki DB me change ho gaya par event kho gaya (ya ulta).
 *
 * BEFORE_COMMIT = transaction commit hone se theek pehle, usi transaction ke andar chalta hai.
 * Services ka code badalna nahi pada - wo pehle jaisa event publish karti hain.
 */
@Component
public class OutboxEventBridge {

    private final OutboxWriter outbox;
    private final EventsProperties properties;

    public OutboxEventBridge(OutboxWriter outbox, EventsProperties properties) {
        this.outbox = outbox;
        this.properties = properties;
    }

    /** Favourite joda/hataya -> engagement.favourite.v1 */
    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT, fallbackExecution = true)
    public void onFavourite(TelemetryEvents.SongFavouriteEvent e) {
        if (!enabled()) return;
        outbox.write(Topics.FAVOURITE, e.userId(), map(
                "user_id", e.userId(), "song_id", e.songId(), "added", e.isAdd()));
    }

    /** Playlist me song joda/hataya -> engagement.playlist-song.v1 */
    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT, fallbackExecution = true)
    public void onPlaylistSong(TelemetryEvents.PlaylistSongEvent e) {
        if (!enabled()) return;
        outbox.write(Topics.PLAYLIST_SONG, e.userId(), map(
                "user_id", e.userId(), "song_id", e.songId(), "added", e.isAdd()));
    }

    /** Artist follow -> social.artist-follow.v1 (followed = true) */
    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT, fallbackExecution = true)
    public void onFollow(TelemetryEvents.ArtistFollowEvent e) {
        if (!enabled()) return;
        outbox.write(Topics.ARTIST_FOLLOW, e.userId(), map(
                "user_id", e.userId(), "artist_id", e.artistId(), "followed", true));
    }

    /** Artist unfollow -> social.artist-follow.v1 (followed = false) */
    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT, fallbackExecution = true)
    public void onUnfollow(TelemetryEvents.ArtistUnfollowEvent e) {
        if (!enabled()) return;
        outbox.write(Topics.ARTIST_FOLLOW, e.userId(), map(
                "user_id", e.userId(), "artist_id", e.artistId(), "followed", false));
    }

    /** Naya user -> user.lifecycle.v1 (SIGNED_UP) */
    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT, fallbackExecution = true)
    public void onRegistered(TelemetryEvents.UserRegisteredEvent e) {
        if (!enabled()) return;
        outbox.write(Topics.USER_LIFECYCLE, e.userId(), map(
                "user_id", e.userId(), "type", "SIGNED_UP", "followed_artist_ids", List.of()));
    }

    /** Onboarding khatam -> user.lifecycle.v1 (ONBOARDED, chune hue artists ke saath) */
    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT, fallbackExecution = true)
    public void onOnboarded(TelemetryEvents.OnboardingSeededEvent e) {
        if (!enabled()) return;
        List<String> artists = e.followedArtistIds() == null ? List.of() : e.followedArtistIds();
        outbox.write(Topics.USER_LIFECYCLE, e.userId(), map(
                "user_id", e.userId(), "type", "ONBOARDED", "followed_artist_ids", artists));
    }

    /** Sirf DUAL/KAFKA mode me outbox likhna hai. */
    private boolean enabled() {
        return properties.mode().producesEvents();
    }

    /** Chhota helper: map("a", 1, "b", 2) -> {a=1, b=2} (order wahi rehta hai). */
    private static Map<String, Object> map(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
        return m;
    }
}

package me.one_org.melody.Events;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.AlgoliaSearch.AlgoliaSearch;
import me.one_org.melody.Enums.PlaylistPrivacyEnum;
import me.one_org.melody.Utils.RetryUtil;

/**
 * Playlist badalne pe Algolia (search) ko update karta hai.
 * Flow: service event publish karti hai -> commit ke baad yahan aata hai -> Algolia API (3 retries).
 *
 * @Async + @TransactionalEventListener(AFTER_COMMIT) ka matlab: jab DB transaction successfully commit ho
 * jaaye, tab ye method alag thread pe chalta hai. Isliye user ki request ko Algolia/Recombee ka wait nahi karna padta,
 * aur agar transaction fail hua to ye chalta hi nahi. fallbackExecution = true: transaction na ho tab bhi chalo.
 */
@Component
@Slf4j
public class AlgoliaEventListener {

    private final AlgoliaSearch algoliaSearch;

    public AlgoliaEventListener(AlgoliaSearch algoliaSearch) {
        this.algoliaSearch = algoliaSearch;
    }

    /** Official playlist ka naam/details Algolia me save karo. */
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onPlaylistSync(AlgoliaEvents.PlaylistIndexSyncEvent event) {
        RetryUtil.executeWithRetry(
                () -> algoliaSearch.savePlaylist(event.playlistId(), event.name()),
                3, 500L, "Algolia savePlaylist [" + event.playlistId() + "]", log
        );
    }

    /** User playlist: PUBLIC hai to search me daalo, PRIVATE/link wali hai to search se hata do. */
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onUserPlaylistSync(AlgoliaEvents.UserPlaylistIndexSyncEvent event) {
        RetryUtil.executeWithRetry(() -> {
            if (event.privacy() == PlaylistPrivacyEnum.PUBLIC) {
                algoliaSearch.saveUserPlaylist(
                        event.playlistId(),
                        event.name(),
                        event.privacy().name(),
                        event.shareToken(),
                        event.totalSongs(),
                        event.ownerId(),
                        event.ownerName()
                );
            } else {
                algoliaSearch.delete(event.playlistId());
            }
        }, 3, 500L, "Algolia syncUserPlaylist [" + event.playlistId() + "]", log);
    }

    /** Delete hui playlist ko Algolia se bhi hatao. */
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onPlaylistDelete(AlgoliaEvents.PlaylistIndexDeleteEvent event) {
        RetryUtil.executeWithRetry(
                () -> algoliaSearch.delete(event.playlistId()),
                3, 500L, "Algolia delete playlist [" + event.playlistId() + "]", log
        );
    }
}


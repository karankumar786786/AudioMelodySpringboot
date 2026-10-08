package me.one_org.melody.Events;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.AlgoliaSearch.AlgoliaSearch;

@Component
@Slf4j
public class AlgoliaEventListener {

    private final AlgoliaSearch algoliaSearch;

    public AlgoliaEventListener(AlgoliaSearch algoliaSearch) {
        this.algoliaSearch = algoliaSearch;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onPlaylistSync(AlgoliaEvents.PlaylistIndexSyncEvent event) {
        try {
            algoliaSearch.savePlaylist(event.playlistId(), event.name());
        } catch (Exception e) {
            log.warn("Failed to sync playlist in Algolia for [{}] ({}): {}", event.playlistId(), event.name(), e.getMessage());
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onPlaylistDelete(AlgoliaEvents.PlaylistIndexDeleteEvent event) {
        try {
            algoliaSearch.delete(event.playlistId());
        } catch (Exception e) {
            log.warn("Failed to delete playlist from Algolia for [{}]: {}", event.playlistId(), e.getMessage());
        }
    }
}

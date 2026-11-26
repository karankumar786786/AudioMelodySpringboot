package me.oneorg.melody.streams;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;

import me.oneorg.melody.events.EventIds;
import me.oneorg.melody.events.EventMeta;
import me.oneorg.melody.events.PlayEvent;
import me.oneorg.melody.events.QueueAction;
import me.oneorg.melody.events.QueueChange;
import me.oneorg.melody.events.SearchAction;
import me.oneorg.melody.events.SearchInteraction;
import me.oneorg.melody.events.UserLifecycleEvent;
import me.oneorg.melody.events.UserLifecycleType;
import me.oneorg.melody.streams.sync.SyncPlan;

/**
 * Unit test: SyncPlan ko akele check karta hai.
 * Har @Test method ek behaviour check karta hai - method ka naam batata hai kya.
 */
class SyncPlanTest {

    private final EventMeta meta = EventIds.meta(EventIds.newId(), Instant.now(), Instant.now(), "t");

    @Test
    void mapsEventsToTheSameSignalsTheCoreApiSent() {
        SyncPlan plan = SyncPlan.of(List.of(
                PlayEvent.newBuilder().setMeta(meta).setUserId("u").setSongId("s1").setListenedRatio(0.95).setDurationMs(200_000L).build(),
                PlayEvent.newBuilder().setMeta(meta).setUserId("u").setSongId("s2").setListenedRatio(0.1).setDurationMs(200_000L).build(),
                QueueChange.newBuilder().setMeta(meta).setUserId("u").setSongId("s3").setAction(QueueAction.REMOVE).build(),
                SearchInteraction.newBuilder().setMeta(meta).setUserId(null).setAction(SearchAction.CLICK).setEntityType("ARTIST").setEntityId("a1").build(),
                SearchInteraction.newBuilder().setMeta(meta).setUserId(null).setAction(SearchAction.CLICK).setEntityType("ARTIST").setEntityId("a1").build(),
                UserLifecycleEvent.newBuilder().setMeta(meta).setUserId("u2").setType(UserLifecycleType.ONBOARDED).setFollowedArtistIds(List.of("a1")).build()));

        assertThat(plan.ratings).contains(new SyncPlan.Rating("u", "s1", 0.7), new SyncPlan.Rating("u", "s2", -0.3),
                new SyncPlan.Rating("u", "s3", -0.4));
        assertThat(plan.bookmarks).containsExactly(new SyncPlan.Bookmark("u", "s3", false));
        assertThat(plan.searchCounts).containsEntry("a1", 2L);
        assertThat(plan.detailViews).isEmpty();
        assertThat(plan.streamedSongs).containsExactly("s1");
        assertThat(plan.newUsers).containsExactly("u2");
        assertThat(plan.onboarding).containsEntry("u2", List.of("a1"));
    }
}

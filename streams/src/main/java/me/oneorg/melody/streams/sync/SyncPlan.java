package me.oneorg.melody.streams.sync;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.apache.avro.specific.SpecificRecord;

import me.oneorg.melody.events.ArtistFollowChanged;
import me.oneorg.melody.events.FavouriteChanged;
import me.oneorg.melody.events.PlayEvent;
import me.oneorg.melody.events.PlaylistSongChanged;
import me.oneorg.melody.events.QueueChange;
import me.oneorg.melody.events.SearchAction;
import me.oneorg.melody.events.SearchInteraction;
import me.oneorg.melody.events.SkipEvent;
import me.oneorg.melody.events.SongFeedback;
import me.oneorg.melody.events.UserLifecycleEvent;
import me.oneorg.melody.events.UserLifecycleType;
import me.oneorg.melody.streams.stats.StatsTopology;

/**
 * What one batch of events means for Recombee and Algolia. Pure, so the mapping can be
 * tested without either service. Ratings match the core API's Recombee.java.
 */
public final class SyncPlan {

    public record Rating(String userId, String itemId, double rating) {}
    public record DetailView(String userId, String itemId) {}
    public record Bookmark(String userId, String itemId, boolean add) {}

    public final List<Rating> ratings = new ArrayList<>();
    public final List<DetailView> detailViews = new ArrayList<>();
    public final List<Bookmark> bookmarks = new ArrayList<>();
    public final Set<String> newUsers = new LinkedHashSet<>();
    /** user -> artists they followed during onboarding (seeded with plays of top songs). */
    public final Map<String, List<String>> onboarding = new LinkedHashMap<>();
    /** Algolia searchCount increments per object id. */
    public final Map<String, Long> searchCounts = new LinkedHashMap<>();
    /** Songs whose total_streams changed; their new totals are read from Postgres. */
    public final Set<String> streamedSongs = new LinkedHashSet<>();

    public static double playRating(double ratio) {
        if (ratio >= 0.90) return 0.7;
        if (ratio >= 0.50) return 0.3;
        if (ratio >= 0.25) return 0.1;
        return -0.3;
    }

    public static SyncPlan of(List<SpecificRecord> events) {
        SyncPlan plan = new SyncPlan();
        for (SpecificRecord event : events) plan.add(event);
        return plan;
    }

    void add(SpecificRecord event) {
        switch (event) {
            case PlayEvent e -> {
                ratings.add(new Rating(e.getUserId(), e.getSongId(), playRating(e.getListenedRatio())));
                if (StatsTopology.qualifies(e.getListenedRatio(), e.getDurationMs())) streamedSongs.add(e.getSongId());
            }
            case SkipEvent e -> ratings.add(new Rating(e.getUserId(), e.getSongId(), -1.0));
            case SearchInteraction e -> {
                searchCounts.merge(e.getEntityId(), 1L, Long::sum);
                boolean songPlay = e.getAction() == SearchAction.PLAY || "SONG".equalsIgnoreCase(e.getEntityType());
                if (e.getUserId() != null && songPlay) detailViews.add(new DetailView(e.getUserId(), e.getEntityId()));
            }
            case QueueChange e -> {
                switch (e.getAction()) {
                    case ADD -> bookmarks.add(new Bookmark(e.getUserId(), e.getSongId(), true));
                    case REMOVE -> {
                        bookmarks.add(new Bookmark(e.getUserId(), e.getSongId(), false));
                        ratings.add(new Rating(e.getUserId(), e.getSongId(), -0.4));
                    }
                }
            }
            case SongFeedback e -> ratings.add(new Rating(e.getUserId(), e.getSongId(),
                    switch (e.getAction()) { case DISLIKE -> -1.0; case SHARE -> 0.6; }));
            case FavouriteChanged e -> ratings.add(new Rating(e.getUserId(), e.getSongId(), e.getAdded() ? 1.0 : -0.5));
            case PlaylistSongChanged e -> ratings.add(new Rating(e.getUserId(), e.getSongId(), e.getAdded() ? 0.8 : -0.4));
            case ArtistFollowChanged e -> ratings.add(new Rating(e.getUserId(), e.getArtistId(), e.getFollowed() ? 1.0 : -0.5));
            case UserLifecycleEvent e -> {
                newUsers.add(e.getUserId());
                if (e.getType() == UserLifecycleType.ONBOARDED && !e.getFollowedArtistIds().isEmpty()) {
                    onboarding.put(e.getUserId(), List.copyOf(e.getFollowedArtistIds()));
                }
            }
            default -> { }
        }
    }

    public boolean isEmpty() {
        return ratings.isEmpty() && detailViews.isEmpty() && bookmarks.isEmpty() && newUsers.isEmpty()
                && onboarding.isEmpty() && searchCounts.isEmpty() && streamedSongs.isEmpty();
    }
}

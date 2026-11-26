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
 * Events ke ek batch ka Recombee aur Algolia ke liye kya matlab hai. Pure (koi bahar ki call nahi), to
 * bina dono services ke test ho sakta hai. Ratings core API ke Recombee.java jaise hi hain.
 */
public final class SyncPlan {

    /** Recombee ko bhejne wali ek rating. */
    public record Rating(String userId, String itemId, double rating) {}
    /** Recombee detail view. */
    public record DetailView(String userId, String itemId) {}
    /** Recombee bookmark jodna/hatana. */
    public record Bookmark(String userId, String itemId, boolean add) {}

    public final List<Rating> ratings = new ArrayList<>();
    public final List<DetailView> detailViews = new ArrayList<>();
    public final List<Bookmark> bookmarks = new ArrayList<>();
    public final Set<String> newUsers = new LinkedHashSet<>();
    /** user -> onboarding me follow kiye artists (unke top gaano ke plays se seed karte hain). */
    public final Map<String, List<String>> onboarding = new LinkedHashMap<>();
    /** Har object id ka Algolia searchCount kitna badhana hai. */
    public final Map<String, Long> searchCounts = new LinkedHashMap<>();
    /** Jin songs ka total_streams badla; naye totals Postgres se padhte hain. */
    public final Set<String> streamedSongs = new LinkedHashSet<>();

    /** Kitna suna -> rating: 90%+ = 0.7, 50%+ = 0.3, 25%+ = 0.1, warna -0.3. */
    public static double playRating(double ratio) {
        if (ratio >= 0.90) return 0.7;
        if (ratio >= 0.50) return 0.3;
        if (ratio >= 0.25) return 0.1;
        return -0.3;
    }

    /** Events ki list se plan banao. */
    public static SyncPlan of(List<SpecificRecord> events) {
        SyncPlan plan = new SyncPlan();
        for (SpecificRecord event : events) plan.add(event);
        return plan;
    }

    /** Ek event ko plan me jodo (type ke hisaab se rating / bookmark / searchCount / streams). */
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

    /** Plan me kuch bhejna hai? */
    public boolean isEmpty() {
        return ratings.isEmpty() && detailViews.isEmpty() && bookmarks.isEmpty() && newUsers.isEmpty()
                && onboarding.isEmpty() && searchCounts.isEmpty() && streamedSongs.isEmpty();
    }
}

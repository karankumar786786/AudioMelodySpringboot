package me.oneorg.melody.events;

/**
 * Saare Kafka topic naam ek jagah. infra/kafka/topics.yaml se match hone chahiye.
 * Schema me breaking change ho to naya topic (.v2) banao, .v1 ko kabhi edit mat karo.
 */
public final class Topics {

    private Topics() {}

    // Telemetry: core API seedha Kafka pe bhejta hai.
    public static final String PLAY = "listening.play.v1";
    public static final String SKIP = "listening.skip.v1";
    public static final String SEARCH_INTERACTION = "search.interaction.v1";
    public static final String QUEUE_CHANGE = "queue.change.v1";
    public static final String FEEDBACK = "engagement.feedback.v1";

    // State changes: pehle Postgres (outbox) me save, phir outboxRelay publish karta hai.
    public static final String FAVOURITE = "engagement.favourite.v1";
    public static final String PLAYLIST_SONG = "engagement.playlist-song.v1";
    public static final String ARTIST_FOLLOW = "social.artist-follow.v1";
    public static final String USER_LIFECYCLE = "user.lifecycle.v1";
    public static final String CATALOG_SONG = "catalog.song.v1";
    public static final String EMAIL = "notification.email.v1";

    // Stream services (streams/) inhe banati hain.
    public static final String EMAIL_RETRY = "notification.email.retry.v1";
    public static final String STATS_SONG = "stats.song.v1";
    public static final String STATS_SONG_DAILY = "stats.song-daily.v1";
    public static final String STATS_ARTIST = "stats.artist.v1";
    public static final String ACTIVITY_SESSION = "activity.session.v1";
    public static final String DLQ = "pipeline.dlq.v1";

    // Song analytics (streams/ ka analytics profile).
    public static final String ANALYTICS_SONG_TIMELINE = "analytics.song-timeline.v1";
    public static final String ANALYTICS_SONG_DAILY = "analytics.song-daily.v1";
    public static final String ANALYTICS_SONG_QUALITY = "analytics.song-quality.v1";

    /** Commit ke baad outboxRelay ko simple string wala "jaago" signal; Avro nahi, aur koi aur isko nahi padhta. */
    public static final String OUTBOX_WAKEUP = "outbox.wakeup.v1";
}

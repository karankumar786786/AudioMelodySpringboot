package me.oneorg.melody.events;

/**
 * Every topic name in one place. Must match infra/kafka/topics.yaml.
 * A breaking schema change gets a new topic (.v2), never an edit of .v1.
 */
public final class Topics {

    private Topics() {}

    // Telemetry, produced by the core API straight to Kafka.
    public static final String PLAY = "listening.play.v1";
    public static final String SKIP = "listening.skip.v1";
    public static final String SEARCH_INTERACTION = "search.interaction.v1";
    public static final String QUEUE_CHANGE = "queue.change.v1";
    public static final String FEEDBACK = "engagement.feedback.v1";

    // State changes, saved in Postgres first and published by outboxRelay.
    public static final String FAVOURITE = "engagement.favourite.v1";
    public static final String PLAYLIST_SONG = "engagement.playlist-song.v1";
    public static final String ARTIST_FOLLOW = "social.artist-follow.v1";
    public static final String USER_LIFECYCLE = "user.lifecycle.v1";
    public static final String CATALOG_SONG = "catalog.song.v1";
    public static final String EMAIL = "notification.email.v1";

    // Produced by the stream services.
    public static final String EMAIL_RETRY = "notification.email.retry.v1";
    public static final String STATS_SONG = "stats.song.v1";
    public static final String STATS_SONG_DAILY = "stats.song-daily.v1";
    public static final String STATS_ARTIST = "stats.artist.v1";
    public static final String ACTIVITY_SESSION = "activity.session.v1";
    public static final String DLQ = "pipeline.dlq.v1";

    /** Plain-string nudge to outboxRelay after a commit; not Avro, not consumed by anything else. */
    public static final String OUTBOX_WAKEUP = "outbox.wakeup.v1";
}

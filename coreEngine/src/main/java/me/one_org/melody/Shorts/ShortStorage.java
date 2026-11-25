package me.one_org.melody.Shorts;

import java.time.Duration;

/** Where listeners upload raw short videos. */
public interface ShortStorage {
    /** A pre-signed PUT URL for {@code key} in the temp bucket. */
    String presignUpload(String key, String contentType, long contentLength, Duration ttl);
}

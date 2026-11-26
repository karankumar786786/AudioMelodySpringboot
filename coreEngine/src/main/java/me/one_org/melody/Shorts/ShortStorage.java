package me.one_org.melody.Shorts;

import java.time.Duration;

/** Listeners raw short video kahan upload karein (asli kaam S3ShortStorage; tests me nakli). */
public interface ShortStorage {
    /** Temp bucket me {@code key} pe PUT karne ka presigned URL. */
    String presignUpload(String key, String contentType, long contentLength, Duration ttl);
}

package me.one_org.melody.Shorts;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** melody.shorts.* settings. */
@ConfigurationProperties(prefix = "melody.shorts")
public record ShortsProperties(
        String tempBucket,
        String region,
        long maxUploadBytes,
        int maxUploadsPerDay,
        Duration uploadUrlTtl,
        int autoHideReports,
        String inngestEventUrl,
        String inngestEventKey) {

    public ShortsProperties {
        if (tempBucket == null || tempBucket.isBlank()) tempBucket = "audiomelodyspringboottemp";
        if (region == null || region.isBlank()) region = "ap-south-1";
        if (maxUploadBytes <= 0) maxUploadBytes = 100L * 1024 * 1024;
        if (maxUploadsPerDay <= 0) maxUploadsPerDay = 5;
        if (uploadUrlTtl == null) uploadUrlTtl = Duration.ofMinutes(15);
        if (autoHideReports <= 0) autoHideReports = 3;
        if (inngestEventUrl == null) inngestEventUrl = "";
        if (inngestEventKey == null) inngestEventKey = "";
    }

    /** Inngest Event API: an explicit URL (dev server) wins, else Inngest Cloud with the event key. */
    public String resolvedInngestUrl() {
        if (!inngestEventUrl.isBlank()) return inngestEventUrl;
        return "https://inn.gs/e/" + inngestEventKey;
    }
}

package me.one_org.melody.Shorts;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** application.yaml ki melody.shorts.* settings. Value na ho to neeche ke defaults. */
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
        if (maxUploadBytes <= 0) maxUploadBytes = 100L * 1024 * 1024; // 100 MB
        if (maxUploadsPerDay <= 0) maxUploadsPerDay = 5;                // ek user ek din me max 5 uploads
        if (uploadUrlTtl == null) uploadUrlTtl = Duration.ofMinutes(15); // presigned URL kitni der chale
        if (autoHideReports <= 0) autoHideReports = 3;                  // itne reports pe short apne aap chhup jaata hai
        if (inngestEventUrl == null) inngestEventUrl = "";
        if (inngestEventKey == null) inngestEventKey = "";
    }

    /** Inngest ka URL: config me diya URL (local dev server) ho to wahi, warna Inngest Cloud + event key. */
    public String resolvedInngestUrl() {
        if (!inngestEventUrl.isBlank()) return inngestEventUrl;
        return "https://inn.gs/e/" + inngestEventKey;
    }
}

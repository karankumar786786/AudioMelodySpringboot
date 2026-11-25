package me.one_org.melody.Shorts;

import java.time.Duration;

import org.springframework.stereotype.Component;

import jakarta.annotation.PreDestroy;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

/**
 * Pre-signs uploads with the default AWS credential chain (instance role in production,
 * AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY locally). Built on first use, so the app
 * starts without AWS configuration.
 */
@Component
public class S3ShortStorage implements ShortStorage {

    private final ShortsProperties properties;
    private volatile S3Presigner presigner;

    public S3ShortStorage(ShortsProperties properties) {
        this.properties = properties;
    }

    private S3Presigner presigner() {
        if (presigner == null) {
            synchronized (this) {
                if (presigner == null) {
                    presigner = S3Presigner.builder().region(Region.of(properties.region())).build();
                }
            }
        }
        return presigner;
    }

    @Override
    public String presignUpload(String key, String contentType, long contentLength, Duration ttl) {
        PutObjectRequest put = PutObjectRequest.builder()
                .bucket(properties.tempBucket())
                .key(key)
                .contentType(contentType)
                .contentLength(contentLength)
                .build();
        return presigner().presignPutObject(PutObjectPresignRequest.builder()
                .signatureDuration(ttl)
                .putObjectRequest(put)
                .build()).url().toString();
    }

    @PreDestroy
    void close() {
        if (presigner != null) presigner.close();
    }
}

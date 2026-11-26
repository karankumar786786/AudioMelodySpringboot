package me.one_org.melody.Shorts;

import java.time.Duration;

import org.springframework.stereotype.Component;

import jakarta.annotation.PreDestroy;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

/**
 * S3 ka "presigned" upload URL banata hai.
 * PRESIGNED URL = ek temporary link jisse app seedha S3 me file PUT kar sakta hai, bina AWS keys ke
 * aur bina hamare server se video guzre. Link thodi der (15 min) baad bekaar ho jaata hai.
 *
 * AWS credentials default chain se aate hain: production me EC2 ka instance role,
 * local me AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY. Presigner pehli baar use pe banta hai,
 * isliye AWS config ke bina bhi app start ho jaata hai.
 */
@Component
public class S3ShortStorage implements ShortStorage {

    private final ShortsProperties properties;
    private volatile S3Presigner presigner;

    public S3ShortStorage(ShortsProperties properties) {
        this.properties = properties;
    }

    /** Presigner ek hi baar banao aur reuse karo (lazy). */
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

    /** key pe PUT karne ka URL; content-type aur size fix hote hain, taaki koi aur file na daal sake. */
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

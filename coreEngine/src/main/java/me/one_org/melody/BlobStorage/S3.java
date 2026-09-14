package me.one_org.melody.BlobStorage;

import java.time.Duration;
import java.util.List;

import org.springframework.stereotype.Component;
import lombok.extern.slf4j.Slf4j;

import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Component
@Slf4j
public class S3 {
    private final S3Client s3Client;
    private final S3Presigner s3Presigner;

    public S3(S3Client s3Client, S3Presigner s3Presigner) {
        this.s3Client = s3Client;
        this.s3Presigner = s3Presigner;
    }

    public void deleteObject(String key, String bucketName) {
        if (key == null || key.isBlank() || bucketName == null || bucketName.isBlank()) return;
        try {
            s3Client.deleteObject(DeleteObjectRequest.builder().bucket(bucketName).key(key).build());
        } catch (Exception e) {
            log.warn("Failed to delete S3 object {} from {}: {}", key, bucketName, e.getMessage());
        }
    }

    public void deletePrefix(String prefix, String bucketName) {
        if (prefix == null || prefix.isBlank() || bucketName == null || bucketName.isBlank()) return;
        try {
            String continuationToken = null;
            do {
                ListObjectsV2Request.Builder listReqBuilder = ListObjectsV2Request.builder()
                        .bucket(bucketName)
                        .prefix(prefix);
                if (continuationToken != null) {
                    listReqBuilder.continuationToken(continuationToken);
                }
                ListObjectsV2Response listRes = s3Client.listObjectsV2(listReqBuilder.build());
                List<ObjectIdentifier> toDelete = listRes.contents().stream()
                        .map(o -> ObjectIdentifier.builder().key(o.key()).build())
                        .toList();
                if (!toDelete.isEmpty()) {
                    s3Client.deleteObjects(DeleteObjectsRequest.builder()
                            .bucket(bucketName)
                            .delete(Delete.builder().objects(toDelete).build())
                            .build());
                    log.info("Deleted {} objects under S3 prefix [{}] from bucket [{}]", toDelete.size(), prefix, bucketName);
                }
                continuationToken = listRes.nextContinuationToken();
            } while (continuationToken != null);
        } catch (Exception e) {
            log.warn("Failed to delete S3 prefix {} in bucket {}: {}", prefix, bucketName, e.getMessage());
        }
    }

    public String preSignedUrl(String key, String bucketName, Duration expiry) {
        return s3Presigner.presignPutObject(
            r -> r.signatureDuration(expiry).putObjectRequest(PutObjectRequest.builder().bucket(bucketName).key(key).build())
        ).url().toExternalForm();
    }
}

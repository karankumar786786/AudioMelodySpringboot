package me.one_org.melody.BlobStorage;

import java.time.Duration;

import org.springframework.stereotype.Component;

import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Component
public class S3 {
    private final S3Client s3Client;
    private final S3Presigner s3Presigner;

    public S3(S3Client s3Client,S3Presigner s3Presigner){
        this.s3Client = s3Client;
        this.s3Presigner = s3Presigner;
    }

    public void deleteObject(String key,String bucketName){
        s3Client.deleteObject(DeleteObjectRequest.builder().bucket(bucketName).key(key).build());
    }
    public String preSignedUrl(String key,String bucketName,Duration expiry){
        return s3Presigner.presignPutObject(
            r -> r.signatureDuration(expiry).putObjectRequest(PutObjectRequest.builder().bucket(bucketName).key(key).build())
        ).url().toExternalForm();
    }
}

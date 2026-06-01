package me.one_org.melody.BlobStrorage;

import java.time.Duration;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;


import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Service
public class s3Service {
    @Autowired
    private S3Client s3Client;
    @Autowired
    private S3Presigner s3Presigner;

    public void deleteObject(String key,String bucketName){
        s3Client.deleteObject(DeleteObjectRequest.builder().bucket(bucketName).key(key).build());
    }
    public String preSignedUrl(String key,String bucketName,Duration expiry){
        return s3Presigner.presignPutObject(
            r -> r.signatureDuration(expiry).putObjectRequest(PutObjectRequest.builder().bucket(bucketName).key(key).build())
        ).url().toExternalForm();
    }
}

package me.one_org.melody.Services.Admin;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import me.one_org.melody.BlobStrorage.S3;
import me.one_org.melody.ImageStorage.ImageKit;

@Service
public class InternalService {
    private final S3 s3client;
    private final ImageKit imageKit;

    @Value("${s3.temp-bucket}")
    private String tempBucket;
    @Value("${s3.temp-url-validity-min}")
    private int tempUrlValidityMin;

    public InternalService(S3 s3Client,ImageKit imageKit){
        this.s3client = s3Client;
        this.imageKit = imageKit;
    }
    public String getSongUploadPreSignedUrl(){
        String key = UUID.randomUUID().toString();
        return s3client.preSignedUrl(key, tempBucket, Duration.ofMinutes(tempUrlValidityMin));
    }

    public Map<String,String> getImageUploadParams(){
        return imageKit.preSignedToken();
    }

}

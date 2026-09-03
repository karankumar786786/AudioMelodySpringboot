package me.one_org.melody.Services.Webhook;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import me.one_org.melody.BlobStorage.S3;
import me.one_org.melody.Dto.Controllers.Webhook.ImageUploadParamsResponseDto;
import me.one_org.melody.Dto.Controllers.Webhook.SongUploadPreSignedUrlResponseDto;
import me.one_org.melody.ImageStorage.ImageKit;

@Service
public class WebhookInternalService {
    private final S3 s3client;
    private final ImageKit imageKit;

    @Value("${s3.temp-bucket:${S3_TEMP_BUCKET:audiomelodyspringboottemp}}")
    private String tempBucket;
    @Value("${s3.temp-url-validity-min:30}")
    private int tempUrlValidityMin;

    public WebhookInternalService(S3 s3Client,ImageKit imageKit){
        this.s3client = s3Client;
        this.imageKit = imageKit;
    }
    public SongUploadPreSignedUrlResponseDto getSongUploadPreSignedUrl(){
        String key = UUID.randomUUID().toString();
        String preSignedUrl = s3client.preSignedUrl(key, tempBucket, Duration.ofMinutes(tempUrlValidityMin));
        System.out.println("[Song Upload] Generated pre-signed URL for S3 upload");
        System.out.println("[Song Upload] bucket=" + tempBucket + ", key=" + key + ", validityMinutes=" + tempUrlValidityMin);
        System.out.println("[Song Upload] preSignedUrl=" + preSignedUrl);
        return new SongUploadPreSignedUrlResponseDto(key, preSignedUrl);
    }

    public SongUploadPreSignedUrlResponseDto getVideoUploadPreSignedUrl(){
        String key = UUID.randomUUID().toString();
        String preSignedUrl = s3client.preSignedUrl(key, tempBucket, Duration.ofMinutes(tempUrlValidityMin));
        System.out.println("[Full Video Upload] Generated pre-signed URL for S3 upload");
        System.out.println("[Full Video Upload] bucket=" + tempBucket + ", key=" + key + ", validityMinutes=" + tempUrlValidityMin);
        System.out.println("[Full Video Upload] preSignedUrl=" + preSignedUrl);
        return new SongUploadPreSignedUrlResponseDto(key, preSignedUrl);
    }

    public ImageUploadParamsResponseDto getImageUploadParams(){
        String key = UUID.randomUUID().toString();
        Map<String,String> param = imageKit.preSignedToken();
        System.out.println("[Image Upload] Generated ImageKit upload params");
        System.out.println("[Image Upload] imageKey=" + key + ", param=" + param);
        return new ImageUploadParamsResponseDto(key, param);
    }

    public ImageUploadParamsResponseDto getVideoUploadParams(){
        String key = UUID.randomUUID().toString();
        Map<String,String> param = imageKit.preSignedToken();
        System.out.println("[Video Upload] Generated ImageKit upload params");
        System.out.println("[Video Upload] videoKey=" + key + ", param=" + param);
        return new ImageUploadParamsResponseDto(key, param);
    }

}

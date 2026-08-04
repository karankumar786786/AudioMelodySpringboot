package me.one_org.melody.Services.Admin;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import me.one_org.melody.BlobStorage.S3;
import me.one_org.melody.Dto.Controllers.Admin.ImageUploadParamsResponseDto;
import me.one_org.melody.Dto.Controllers.Admin.SongUploadPreSignedUrlResponseDto;
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
    public SongUploadPreSignedUrlResponseDto getSongUploadPreSignedUrl(){
        String key = UUID.randomUUID().toString();
        String preSignedUrl = s3client.preSignedUrl(key, tempBucket, Duration.ofMinutes(tempUrlValidityMin));
        return new SongUploadPreSignedUrlResponseDto(key, preSignedUrl);
    }

    public ImageUploadParamsResponseDto getImageUploadParams(){
        String key = UUID.randomUUID().toString();
        Map<String,String> param = imageKit.preSignedToken();
        return new ImageUploadParamsResponseDto(key, param);
    }

}

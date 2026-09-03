package me.one_org.melody.Controllers.Webhook;



import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import me.one_org.melody.Dto.Controllers.Webhook.ImageUploadParamsResponseDto;
import me.one_org.melody.Dto.Controllers.Webhook.SongUploadPreSignedUrlResponseDto;
import me.one_org.melody.Services.Webhook.WebhookInternalService;


@RestController
@RequestMapping("/webhook/internal")
public class WebhookInternalController {

    private final WebhookInternalService inInternalService;

    WebhookInternalController(WebhookInternalService internalService){
        this.inInternalService = internalService;
    }
    @GetMapping("/song-upload-url")
    public ResponseEntity<SongUploadPreSignedUrlResponseDto> getSongUploadPreSignedUrl(){
        return ResponseEntity.status(HttpStatus.OK).body(inInternalService.getSongUploadPreSignedUrl());
    }

    @GetMapping("/video-upload-url")
    public ResponseEntity<SongUploadPreSignedUrlResponseDto> getVideoUploadPreSignedUrl(){
        return ResponseEntity.status(HttpStatus.OK).body(inInternalService.getVideoUploadPreSignedUrl());
    }

    @GetMapping("/image-upload-param")
    public ResponseEntity<ImageUploadParamsResponseDto> getImageUploadParams() {
        return ResponseEntity.status(HttpStatus.OK).body(inInternalService.getImageUploadParams());
    }

    @GetMapping("/video-upload-param")
    public ResponseEntity<ImageUploadParamsResponseDto> getVideoUploadParams() {
        return ResponseEntity.status(HttpStatus.OK).body(inInternalService.getVideoUploadParams());
    }
}

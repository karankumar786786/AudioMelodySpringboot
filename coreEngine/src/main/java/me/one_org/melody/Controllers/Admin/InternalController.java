package me.one_org.melody.Controllers.Admin;



import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import me.one_org.melody.Dto.Controllers.Admin.ImageUploadParamsResponseDto;
import me.one_org.melody.Dto.Controllers.Admin.SongUploadPreSignedUrlResponseDto;
import me.one_org.melody.Services.Admin.InternalService;


@RestController
@RequestMapping("/admin/internal")
public class InternalController {

    private final InternalService inInternalService;

    InternalController(InternalService internalService){
        this.inInternalService = internalService;
    }
    @GetMapping("/song-upload-url")
    public ResponseEntity<SongUploadPreSignedUrlResponseDto> getSongUploadPreSignedUrl(){
        return ResponseEntity.status(HttpStatus.OK).body(inInternalService.getSongUploadPreSignedUrl());
    }

    @GetMapping("/image-upload-param")
    public ResponseEntity<ImageUploadParamsResponseDto> getImageUploadParams() {
        return ResponseEntity.status(HttpStatus.OK).body(inInternalService.getImageUploadParams());
    }
}

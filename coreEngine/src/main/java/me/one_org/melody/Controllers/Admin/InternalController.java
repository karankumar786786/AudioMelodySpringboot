package me.one_org.melody.Controllers.Admin;


import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import me.one_org.melody.Services.Admin.InternalService;
import org.springframework.web.bind.annotation.RequestParam;


@RestController
@RequestMapping("/admin/internal")
public class InternalController {

    private final InternalService inInternalService;

    InternalController(InternalService internalService){
        this.inInternalService = internalService;
    }
    
    @GetMapping("/song-upload-url")
    public ResponseEntity<String> getSongUploadPreSignedUrl(){
        return ResponseEntity.status(HttpStatus.OK).body(inInternalService.getSongUploadPreSignedUrl());
    }

    @GetMapping("/image-upload-url")
    public ResponseEntity<Map<String, String>> getImageUploadParams() {
        return ResponseEntity.status(HttpStatus.OK).body(inInternalService.getImageUploadParams());
    }
    

}

package me.one_org.melody.Controllers.Admin;

import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import me.one_org.melody.Dto.CreateSongRequestDto;
import me.one_org.melody.Dto.CreateSongResponseDto;
import me.one_org.melody.Services.Admin.SongService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;


@RestController
@RequestMapping("/admin/song")
public class SongController {

    private final SongService songService;

    public SongController(SongService songService){
        this.songService = songService;
    }

    @PostMapping
    public ResponseEntity<CreateSongResponseDto> createSong(@RequestBody CreateSongRequestDto  data) {
        CreateSongResponseDto response = songService.createSong(data);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
    
    public void deleteSong(){
        
    }
}

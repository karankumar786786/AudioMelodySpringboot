package me.one_org.melody.Controllers.Admin;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import me.one_org.melody.Dto.Controllers.Admin.CreateSongRequestDto;
import me.one_org.melody.Dto.Controllers.Admin.CreateSongResponseDto;
import me.one_org.melody.Entity.JobsEntity;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Services.Genral.SongService;

@RestController
@RequestMapping("/admin/song")
public class SongController {

    private final SongService songService;

    public SongController(SongService songService){
        this.songService = songService;
    }

    @PostMapping
    public ResponseEntity<CreateSongResponseDto> createSong(@Valid @RequestBody CreateSongRequestDto data) {
        CreateSongResponseDto response = songService.createSong(data);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<SongsEntity>> getAllSongs() {
        return ResponseEntity.ok(songService.getAllSongs());
    }

    @GetMapping("/{id}")
    public ResponseEntity<SongsEntity> getSongById(@PathVariable String id) {
        return ResponseEntity.ok(songService.getSongById(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteSong(@PathVariable String id) {
        songService.deleteSong(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/job/{id}")
    public ResponseEntity<JobsEntity> getJobById(@PathVariable String id) {
        return ResponseEntity.ok(songService.getJobById(id));
    }

    @GetMapping("/jobs")
    public ResponseEntity<List<JobsEntity>> getAllJobs() {
        return ResponseEntity.ok(songService.getAllJobs());
    }
}

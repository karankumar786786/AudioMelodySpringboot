package me.one_org.melody.Controllers.Admin;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import me.one_org.melody.Dto.Controllers.Admin.CreateSongRequestDto;
import me.one_org.melody.Dto.Controllers.Admin.CreateSongResponseDto;
import me.one_org.melody.Dto.Controllers.Admin.ReprocessVideoRequestDto;
import me.one_org.melody.Dto.Controllers.Admin.ToggleFeaturedRequestDto;
import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Entity.JobsEntity;
import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Services.General.SongService;

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
    public ResponseEntity<PaginatedResponseDto<SongsEntity>> getAllSongs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<SongsEntity> songs = songService.getSongsPaginated(page, size);
        PaginationMetaDataEntity metaData = songService.getSongsPaginationMetaData();
        return ResponseEntity.ok(new PaginatedResponseDto<>(songs, page, size, metaData));
    }

    @GetMapping("/{id}")
    public ResponseEntity<SongsEntity> getSongById(@PathVariable String id) {
        return ResponseEntity.ok(songService.getSongById(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<SongsEntity> updateSong(@PathVariable String id, @Valid @RequestBody me.one_org.melody.Dto.Controllers.Admin.UpdateSongRequestDto data) {
        return ResponseEntity.ok(songService.updateSong(id, data));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteSong(@PathVariable String id) {
        songService.deleteSong(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/featured")
    public ResponseEntity<SongsEntity> toggleFeatured(
            @PathVariable String id,
            @Valid @RequestBody ToggleFeaturedRequestDto data) {
        return ResponseEntity.ok(songService.toggleFeatured(id, data.featured()));
    }

    @GetMapping("/job/{id}")
    public ResponseEntity<JobsEntity> getJobById(@PathVariable String id) {
        return ResponseEntity.ok(songService.getJobById(id));
    }

    @GetMapping("/jobs")
    public ResponseEntity<PaginatedResponseDto<JobsEntity>> getAllJobs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<JobsEntity> jobs = songService.getJobsPaginated(page, size);
        PaginationMetaDataEntity metaData = songService.getJobsPaginationMetaData();
        return ResponseEntity.ok(new PaginatedResponseDto<>(jobs, page, size, metaData));
    }

    /**
     * Triggers background re-processing (Shaka packaging) for an existing song's full video.
     * Accepts a temp S3 key for the raw uploaded video, creates a new job and queues it.
     */
    @PostMapping("/{id}/reprocess-video")
    public ResponseEntity<CreateSongResponseDto> reprocessVideo(
            @PathVariable String id,
            @Valid @RequestBody ReprocessVideoRequestDto data) {
        CreateSongResponseDto response = songService.reprocessVideo(id, data.tempVideoKey());
        return ResponseEntity.accepted().body(response);
    }
}

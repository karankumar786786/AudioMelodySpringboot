package me.one_org.melody.Controllers.Admin;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import me.one_org.melody.Dto.Controllers.Admin.CreateSongRequestDto;
import me.one_org.melody.Dto.Controllers.Admin.CreateSongResponseDto;
import me.one_org.melody.Dto.Controllers.Admin.RecoverSongMediaRequestDto;
import me.one_org.melody.Dto.Controllers.Admin.ReprocessAudioRequestDto;
import me.one_org.melody.Dto.Controllers.Admin.ReprocessVideoRequestDto;
import me.one_org.melody.Dto.Controllers.Admin.ToggleFeaturedRequestDto;
import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Entity.JobsEntity;
import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Enums.StatusEnum;
import me.one_org.melody.Recommendation.Recombee;
import me.one_org.melody.Repository.SongsRepository;
import me.one_org.melody.Services.General.SongService;

@RestController
@RequestMapping("/admin/song")
public class SongController {

    private final SongService songService;
    private final Recombee recombee;
    private final SongsRepository songsRepository;

    public SongController(SongService songService, Recombee recombee, SongsRepository songsRepository){
        this.songService = songService;
        this.recombee = recombee;
        this.songsRepository = songsRepository;
    }

    @PostMapping
    public ResponseEntity<CreateSongResponseDto> createSong(@Valid @RequestBody CreateSongRequestDto data) {
        CreateSongResponseDto response = songService.createSong(data);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<PaginatedResponseDto<SongsEntity>> getAllSongs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String search) {
        List<SongsEntity> songs = songService.getSongsPaginated(page, size, search);
        PaginationMetaDataEntity metaData = songService.getSongsPaginationMetaData();

        long totalCount;
        if (search != null && !search.trim().isEmpty()) {
            totalCount = songService.countSongs(search);
        } else {
            totalCount = (metaData != null && metaData.getTotalCount() > 0)
                    ? metaData.getTotalCount()
                    : songService.countSongs(null);
        }

        PaginationMetaDataEntity responseMeta = PaginationMetaDataEntity.builder()
                .id(metaData != null ? metaData.getId() : "SongsEntity")
                .entityName("SongsEntity")
                .totalCount(totalCount)
                .activeCount(metaData != null ? metaData.getActiveCount() : totalCount)
                .blockedCount(metaData != null ? metaData.getBlockedCount() : 0L)
                .deletedCount(metaData != null ? metaData.getDeletedCount() : 0L)
                .build();
        return ResponseEntity.ok(new PaginatedResponseDto<>(songs, page, size, responseMeta));
    }

    @GetMapping("/{id}")
    public ResponseEntity<SongsEntity> getSongById(@PathVariable String id) {
        return ResponseEntity.ok(songService.getSongById(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<SongsEntity> updateSong(@PathVariable String id, @Valid @RequestBody me.one_org.melody.Dto.Controllers.Admin.UpdateSongRequestDto data) {
        SongsEntity updated = songService.updateSong(id, data);
        try {
            recombee.saveSong(updated.getId(), updated.getTitle(), updated.getArtistName(), updated.getLanguage(), updated.getGenre(), updated.getDuration());
        } catch (Exception ignored) {
        }
        return ResponseEntity.ok(updated);
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
     * Triggers background re-transcoding for an existing song's corrupted or replacement audio.
     * Accepts tempSongKey (and optional tempVideoKey), creates a new job and queues it.
     */
    @PostMapping("/{id}/reprocess-audio")
    public ResponseEntity<CreateSongResponseDto> reprocessAudio(
            @PathVariable String id,
            @Valid @RequestBody ReprocessAudioRequestDto data) {
        CreateSongResponseDto response = songService.reprocessAudio(id, data);
        return ResponseEntity.accepted().body(response);
    }

    /**
     * Triggers background re-processing (Shaka packaging) for an existing song's full video.
     * Accepts a temp S3 key for the raw uploaded video, creates a new job and queues it.
     */
    @PostMapping("/{id}/reprocess-video")
    public ResponseEntity<CreateSongResponseDto> reprocessVideo(
            @PathVariable String id,
            @Valid @RequestBody ReprocessVideoRequestDto data) {
        CreateSongResponseDto response = songService.reprocessVideo(id, data);
        return ResponseEntity.accepted().body(response);
    }

    /**
     * Unified media recovery for an existing song.
     * Recovers corrupted audio, video, or both in a single endpoint.
     */
    @PostMapping("/{id}/recover-media")
    public ResponseEntity<CreateSongResponseDto> recoverMedia(
            @PathVariable String id,
            @RequestBody RecoverSongMediaRequestDto data) {
        CreateSongResponseDto response = songService.recoverMedia(id, data);
        return ResponseEntity.accepted().body(response);
    }

    /**
     * Bulk reindex all active songs in Recombee.
     * Call this after genre backfill or schema changes to sync all metadata.
     */
    @PostMapping("/reindex-recombee")
    public ResponseEntity<java.util.Map<String, Object>> reindexRecombee() {
        List<SongsEntity> activeSongs = songsRepository.findByStatus(StatusEnum.ACTIVE);
        try {
            recombee.reindexAll(activeSongs);
            return ResponseEntity.ok(java.util.Map.of(
                    "status", "success",
                    "reindexed", activeSongs.size()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(java.util.Map.of(
                            "status", "error",
                            "message", e.getMessage()));
        }
    }
}

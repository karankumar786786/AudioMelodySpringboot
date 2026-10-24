package me.one_org.melody.Controllers.Api;

import java.util.List;

import java.util.concurrent.TimeUnit;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import org.springframework.validation.annotation.Validated;
import jakarta.validation.constraints.NotBlank;
import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Dto.Controllers.Api.PaginationMetaDataDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Services.Api.SongsApiService;

@RestController
@RequestMapping("/api/songs")
@Validated
public class SongsApiController {

    private final SongsApiService songsAppService;

    public SongsApiController(SongsApiService songsAppService) {
        this.songsAppService = songsAppService;
    }

    @GetMapping
    public ResponseEntity<PaginatedResponseDto<SongDto>> getAllSongs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<SongDto> songs = songsAppService.browseSongs(page, size);
        PaginationMetaDataDto metaData = songsAppService.getPaginationMetaData();
        return ResponseEntity.ok(new PaginatedResponseDto<>(songs, page, size, metaData));
    }

    @GetMapping("/trending")
    public ResponseEntity<List<SongDto>> getTrendingSongs(
            @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(songsAppService.getTrendingSongs(limit));
    }

    @GetMapping("/featured")
    public ResponseEntity<List<SongDto>> getFeaturedSongs() {
        return ResponseEntity.ok(songsAppService.getFeaturedSongs());
    }

    @GetMapping("/{id}")
    public ResponseEntity<SongDto> getSongById(@PathVariable @NotBlank(message = "Song ID is required") String id) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(30, TimeUnit.MINUTES).cachePublic())
                .body(songsAppService.getSongById(id));
    }

    @GetMapping(value = {"/album/{albumName}", "/album/{albumName}/songs"})
    public ResponseEntity<List<SongDto>> getSongsByAlbum(@PathVariable @NotBlank(message = "Album name is required") String albumName) {
        return ResponseEntity.ok(songsAppService.getSongsByAlbum(albumName));
    }

    @GetMapping("/albums")
    public ResponseEntity<List<me.one_org.melody.Dto.Controllers.AlbumDto>> getAllAlbums() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(15, TimeUnit.MINUTES).cachePublic())
                .body(songsAppService.getAllAlbums());
    }
}

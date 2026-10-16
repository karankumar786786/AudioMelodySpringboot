package me.one_org.melody.Controllers.Api;

import java.util.List;

import java.util.concurrent.TimeUnit;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Dto.Controllers.Api.PaginationMetaDataDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Entity.PaginationMetaData;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Services.Api.SongsApiService;

@RestController
@RequestMapping("/api/songs")
public class SongsApiController {

    private final SongsApiService songsAppService;

    public SongsApiController(SongsApiService songsAppService) {
        this.songsAppService = songsAppService;
    }

    @GetMapping
    public ResponseEntity<PaginatedResponseDto<SongDto>> getAllSongs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<Song> songs = songsAppService.browseSongs(page, size);
        List<SongDto> dtos = songs.stream().map(SongDto::fromEntity).toList();
        PaginationMetaData metaData = songsAppService.getPaginationMetaData();
        return ResponseEntity.ok(new PaginatedResponseDto<>(dtos, page, size, PaginationMetaDataDto.fromEntity(metaData)));
    }

    @GetMapping("/trending")
    public ResponseEntity<List<SongDto>> getTrendingSongs(
            @RequestParam(defaultValue = "10") int limit) {
        List<Song> songs = songsAppService.getTrendingSongs(limit);
        return ResponseEntity.ok(songs.stream().map(SongDto::fromEntity).toList());
    }

    @GetMapping("/featured")
    public ResponseEntity<List<SongDto>> getFeaturedSongs() {
        List<Song> songs = songsAppService.getFeaturedSongs();
        return ResponseEntity.ok(songs.stream().map(SongDto::fromEntity).toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<SongDto> getSongById(@PathVariable String id) {
        Song song = songsAppService.getSongById(id);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(30, TimeUnit.MINUTES).cachePublic())
                .body(SongDto.fromEntity(song));
    }

    @GetMapping("/album/{albumName}")
    public ResponseEntity<List<SongDto>> getSongsByAlbum(@PathVariable String albumName) {
        List<Song> songs = songsAppService.getSongsByAlbum(albumName);
        return ResponseEntity.ok(songs.stream().map(SongDto::fromEntity).toList());
    }

    @GetMapping("/albums")
    public ResponseEntity<List<me.one_org.melody.Dto.Controllers.AlbumDto>> getAllAlbums() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(15, TimeUnit.MINUTES).cachePublic())
                .body(songsAppService.getAllAlbums());
    }
}

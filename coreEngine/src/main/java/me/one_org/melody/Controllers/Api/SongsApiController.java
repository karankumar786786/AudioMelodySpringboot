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

/**
 * Songs API: list, trending, featured, videos, ek song, album, country.
 *
 * Controller = HTTP request ka pehla stop. Ye sirf request padhta hai, service ko kaam deta hai,
 * aur response (JSON) lautata hai. Asli logic service me hai.
 */
@RestController
@RequestMapping("/api/songs")
@Validated
public class SongsApiController {

    private final SongsApiService songsAppService;

    public SongsApiController(SongsApiService songsAppService) {
        this.songsAppService = songsAppService;
    }

    /** GET /api/songs?page=&size= - saare songs, page by page. */
    @GetMapping
    public ResponseEntity<PaginatedResponseDto<SongDto>> getAllSongs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<SongDto> songs = songsAppService.browseSongs(page, size);
        PaginationMetaDataDto metaData = songsAppService.getPaginationMetaData();
        return ResponseEntity.ok(new PaginatedResponseDto<>(songs, page, size, metaData));
    }

    /** GET /api/songs/trending?limit=&window=&genre= - trending songs. */
    @GetMapping("/trending")
    public ResponseEntity<List<SongDto>> getTrendingSongs(
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(defaultValue = "7d") String window,
            @RequestParam(required = false) String genre,
            @RequestParam(required = false) String language) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(5, TimeUnit.MINUTES).cachePublic())
                .body(songsAppService.getTrendingSongs(limit, window, genre, language));
    }

    /** GET /api/songs/featured - admin ke featured songs. */
    @GetMapping("/featured")
    public ResponseEntity<List<SongDto>> getFeaturedSongs() {
        return ResponseEntity.ok(songsAppService.getFeaturedSongs());
    }

    /** GET /api/songs/videos?limit= - jin songs ka music video hai. */
    @GetMapping("/videos")
    public ResponseEntity<List<SongDto>> getSongsWithVideo(@RequestParam(defaultValue = "15") int limit) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(10, TimeUnit.MINUTES).cachePublic())
                .body(songsAppService.getSongsWithVideo(limit));
    }

    /** GET /api/songs/{id} - ek song. Na mile to 404. */
    @GetMapping("/{id}")
    public ResponseEntity<SongDto> getSongById(@PathVariable @NotBlank(message = "Song ID is required") String id) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(30, TimeUnit.MINUTES).cachePublic())
                .body(songsAppService.getSongById(id));
    }

    /** GET /api/songs/album/{albumName} - album ke songs. */
    @GetMapping(value = {"/album/{albumName}", "/album/{albumName}/songs"})
    public ResponseEntity<List<SongDto>> getSongsByAlbum(@PathVariable @NotBlank(message = "Album name is required") String albumName) {
        return ResponseEntity.ok(songsAppService.getSongsByAlbum(albumName));
    }

    /** GET /api/songs/country/{countryName} - ek country ke songs. */
    @GetMapping(value = {"/country/{countryName}", "/country/{countryName}/songs"})
    public ResponseEntity<List<SongDto>> getSongsByCountry(@PathVariable @NotBlank(message = "Country name is required") String countryName) {
        return ResponseEntity.ok(songsAppService.getSongsByCountry(countryName));
    }

    /** GET /api/songs/albums - saare albums ki list. */
    @GetMapping("/albums")
    public ResponseEntity<List<me.one_org.melody.Dto.Controllers.AlbumDto>> getAllAlbums() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(15, TimeUnit.MINUTES).cachePublic())
                .body(songsAppService.getAllAlbums());
    }
}

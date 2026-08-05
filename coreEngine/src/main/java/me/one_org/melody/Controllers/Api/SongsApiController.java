package me.one_org.melody.Controllers.Api;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Services.Api.SongsApiService;

@RestController
@RequestMapping("/api/songs")
public class SongsApiController {

    private final SongsApiService songsAppService;

    public SongsApiController(SongsApiService songsAppService) {
        this.songsAppService = songsAppService;
    }

    @GetMapping
    public ResponseEntity<PaginatedResponseDto<SongsEntity>> getAllSongs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<SongsEntity> songs = songsAppService.browseSongs(page, size);
        PaginationMetaDataEntity metaData = songsAppService.getPaginationMetaData();
        return ResponseEntity.ok(new PaginatedResponseDto<>(songs, page, size, metaData));
    }

    @GetMapping("/{id}")
    public ResponseEntity<SongsEntity> getSongById(@PathVariable String id) {
        return ResponseEntity.ok(songsAppService.getSongById(id));
    }
}

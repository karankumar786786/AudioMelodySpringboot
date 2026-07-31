package me.one_org.melody.Controllers.App;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Services.App.SongsAppService;

@RestController
@RequestMapping("/app/songs")
public class SongsController {

    private final SongsAppService songsAppService;

    public SongsController(SongsAppService songsAppService) {
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

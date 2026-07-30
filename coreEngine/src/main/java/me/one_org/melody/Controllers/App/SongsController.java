package me.one_org.melody.Controllers.App;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
    public ResponseEntity<Map<String, Object>> browseSongs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<SongsEntity> songs = songsAppService.browseSongs(page, size);
        long total = songsAppService.getTotalSongs();
        return ResponseEntity.ok(Map.of(
                "songs", songs,
                "page", page,
                "size", size,
                "total", total
        ));
    }

    @GetMapping("/{id}")
    public ResponseEntity<SongsEntity> getSongById(@PathVariable String id) {
        return ResponseEntity.ok(songsAppService.getSongById(id));
    }
}

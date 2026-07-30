package me.one_org.melody.Controllers.App;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import me.one_org.melody.Entity.PlaylistsEntity;
import me.one_org.melody.Services.App.PlaylistAppService;

@RestController
@RequestMapping("/app/playlists")
public class PlaylistController {

    private final PlaylistAppService playlistAppService;

    public PlaylistController(PlaylistAppService playlistAppService) {
        this.playlistAppService = playlistAppService;
    }

    @GetMapping
    public ResponseEntity<List<PlaylistsEntity>> getAllPlaylists() {
        return ResponseEntity.ok(playlistAppService.getAllPlaylists());
    }

    @GetMapping("/{id}")
    public ResponseEntity<PlaylistsEntity> getPlaylistById(@PathVariable String id) {
        return ResponseEntity.ok(playlistAppService.getPlaylistById(id));
    }
}

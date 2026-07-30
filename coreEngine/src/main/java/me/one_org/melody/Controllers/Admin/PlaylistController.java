package me.one_org.melody.Controllers.Admin;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import me.one_org.melody.Dto.Controllers.Admin.AddSongToPlaylistRequestDto;
import me.one_org.melody.Dto.Controllers.Admin.CreatePlaylistRequestDto;
import me.one_org.melody.Dto.Controllers.Admin.UpdatePlaylistRequestDto;
import me.one_org.melody.Entity.PlaylistsEntity;
import me.one_org.melody.Services.Genral.PlaylistService;

@RestController
@RequestMapping("/admin/playlist")
public class PlaylistController {

    private final PlaylistService playlistService;

    public PlaylistController(PlaylistService playlistService) {
        this.playlistService = playlistService;
    }

    @PostMapping
    public ResponseEntity<PlaylistsEntity> createPlaylist(@Valid @RequestBody CreatePlaylistRequestDto data) {
        return ResponseEntity.status(HttpStatus.CREATED).body(playlistService.createPlaylist(data));
    }

    @PutMapping("/{id}")
    public ResponseEntity<PlaylistsEntity> updatePlaylist(@PathVariable String id,
                                                           @Valid @RequestBody UpdatePlaylistRequestDto data) {
        return ResponseEntity.ok(playlistService.updatePlaylist(id, data));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePlaylist(@PathVariable String id) {
        playlistService.deletePlaylist(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    public ResponseEntity<List<PlaylistsEntity>> getAllPlaylists() {
        return ResponseEntity.ok(playlistService.getAllPlaylists());
    }

    @GetMapping("/{id}")
    public ResponseEntity<PlaylistsEntity> getPlaylistById(@PathVariable String id) {
        return ResponseEntity.ok(playlistService.getPlaylistById(id));
    }

    @PostMapping("/{id}/songs")
    public ResponseEntity<PlaylistsEntity> addSong(@PathVariable String id,
                                                    @Valid @RequestBody AddSongToPlaylistRequestDto data) {
        return ResponseEntity.ok(playlistService.addSongToPlaylist(id, data.songId()));
    }

    @DeleteMapping("/{id}/songs/{songId}")
    public ResponseEntity<PlaylistsEntity> removeSong(@PathVariable String id, @PathVariable String songId) {
        return ResponseEntity.ok(playlistService.removeSongFromPlaylist(id, songId));
    }
}

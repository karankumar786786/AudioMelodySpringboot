package me.one_org.melody.Controllers.App;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import me.one_org.melody.Dto.Controllers.Apps.AddSongToUserPlaylistRequestDto;
import me.one_org.melody.Dto.Controllers.Apps.CreateUserPlaylistRequestDto;
import me.one_org.melody.Dto.Controllers.Apps.RenameUserPlaylistRequestDto;
import me.one_org.melody.Entity.UserPlaylistsEntity;
import me.one_org.melody.Services.App.UserPlaylistAppService;

@RestController
@RequestMapping("/app/user/playlists")
public class UserPlaylistController {

    private final UserPlaylistAppService userPlaylistAppService;

    public UserPlaylistController(UserPlaylistAppService userPlaylistAppService) {
        this.userPlaylistAppService = userPlaylistAppService;
    }

    @GetMapping
    public ResponseEntity<List<UserPlaylistsEntity>> getUserPlaylists(
            @RequestAttribute("userId") String userId) {
        return ResponseEntity.ok(userPlaylistAppService.getUserPlaylists(userId));
    }

    @PostMapping
    public ResponseEntity<UserPlaylistsEntity> createPlaylist(
            @RequestAttribute("userId") String userId,
            @Valid @RequestBody CreateUserPlaylistRequestDto data) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(userPlaylistAppService.createPlaylist(userId, data.name()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<UserPlaylistsEntity> renamePlaylist(
            @RequestAttribute("userId") String userId,
            @PathVariable String id,
            @Valid @RequestBody RenameUserPlaylistRequestDto data) {
        return ResponseEntity.ok(userPlaylistAppService.renamePlaylist(userId, id, data.name()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePlaylist(
            @RequestAttribute("userId") String userId,
            @PathVariable String id) {
        userPlaylistAppService.deletePlaylist(userId, id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/songs")
    public ResponseEntity<UserPlaylistsEntity> addSong(
            @RequestAttribute("userId") String userId,
            @PathVariable String id,
            @Valid @RequestBody AddSongToUserPlaylistRequestDto data) {
        return ResponseEntity.ok(userPlaylistAppService.addSong(userId, id, data.songId()));
    }

    @DeleteMapping("/{id}/songs/{songId}")
    public ResponseEntity<UserPlaylistsEntity> removeSong(
            @RequestAttribute("userId") String userId,
            @PathVariable String id,
            @PathVariable String songId) {
        return ResponseEntity.ok(userPlaylistAppService.removeSong(userId, id, songId));
    }
}

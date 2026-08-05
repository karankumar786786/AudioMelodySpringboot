package me.one_org.melody.Controllers.Api;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Dto.Controllers.Api.AddSongToUserPlaylistRequestDto;
import me.one_org.melody.Dto.Controllers.Api.CreateUserPlaylistRequestDto;
import me.one_org.melody.Dto.Controllers.Api.RenameUserPlaylistRequestDto;
import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Entity.UserPlaylistsEntity;
import me.one_org.melody.Services.Api.UserPlaylistApiService;

@RestController
@RequestMapping("/api/user/playlists")
public class UserPlaylistApiController {

    private final UserPlaylistApiService userPlaylistAppService;

    public UserPlaylistApiController(UserPlaylistApiService userPlaylistAppService) {
        this.userPlaylistAppService = userPlaylistAppService;
    }

    @GetMapping
    public ResponseEntity<PaginatedResponseDto<UserPlaylistsEntity>> getUserPlaylists(
            @RequestAttribute("userId") String userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<UserPlaylistsEntity> playlists = userPlaylistAppService.getUserPlaylistsPaginated(userId, page, size);
        PaginationMetaDataEntity metaData = userPlaylistAppService.getPaginationMetaData(userId);
        return ResponseEntity.ok(new PaginatedResponseDto<>(playlists, page, size, metaData));
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

    @GetMapping("/{id}")
    public ResponseEntity<UserPlaylistsEntity> getPlaylistById(
            @RequestAttribute("userId") String userId,
            @PathVariable String id) {
        return ResponseEntity.ok(userPlaylistAppService.getPlaylistById(userId, id));
    }

    @GetMapping("/{id}/songs")
    public ResponseEntity<java.util.Set<me.one_org.melody.Entity.SongsEntity>> getPlaylistSongs(
            @RequestAttribute("userId") String userId,
            @PathVariable String id) {
        return ResponseEntity.ok(userPlaylistAppService.getPlaylistSongs(userId, id));
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

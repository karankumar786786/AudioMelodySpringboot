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
import me.one_org.melody.Dto.Controllers.Api.UpdatePlaylistPrivacyRequestDto;
import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Entity.SongsEntity;
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
                .body(userPlaylistAppService.createPlaylist(userId, data.name(), data.privacy()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<UserPlaylistsEntity> renamePlaylist(
            @RequestAttribute("userId") String userId,
            @PathVariable String id,
            @Valid @RequestBody RenameUserPlaylistRequestDto data) {
        return ResponseEntity.ok(userPlaylistAppService.renamePlaylist(userId, id, data.name()));
    }

    @PatchMapping("/{id}/privacy")
    public ResponseEntity<UserPlaylistsEntity> updatePlaylistPrivacy(
            @RequestAttribute("userId") String userId,
            @PathVariable String id,
            @Valid @RequestBody UpdatePlaylistPrivacyRequestDto data) {
        return ResponseEntity.ok(userPlaylistAppService.updatePlaylistPrivacy(userId, id, data.privacy()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserPlaylistsEntity> getPlaylistById(
            @RequestAttribute("userId") String userId,
            @PathVariable String id) {
        return ResponseEntity.ok(userPlaylistAppService.getPlaylistById(userId, id));
    }

    @GetMapping("/{id}/songs")
    public ResponseEntity<PaginatedResponseDto<me.one_org.melody.Entity.SongsEntity>> getPlaylistSongs(
            @RequestAttribute("userId") String userId,
            @PathVariable String id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<SongsEntity> songs = userPlaylistAppService.getPlaylistSongsPaginated(userId, id, page, size);
        PaginationMetaDataEntity metaData = userPlaylistAppService.getPlaylistSongsPaginationMetaData(id);
        return ResponseEntity.ok(new PaginatedResponseDto<>(songs, page, size, metaData));
    }

    @GetMapping("/shared/{tokenOrId}")
    public ResponseEntity<UserPlaylistsEntity> getSharedPlaylist(
            @RequestAttribute(value = "userId", required = false) String userId,
            @PathVariable String tokenOrId) {
        return ResponseEntity.ok(userPlaylistAppService.getSharedPlaylist(tokenOrId, userId));
    }

    @GetMapping("/shared/{tokenOrId}/songs")
    public ResponseEntity<PaginatedResponseDto<SongsEntity>> getSharedPlaylistSongs(
            @RequestAttribute(value = "userId", required = false) String userId,
            @PathVariable String tokenOrId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        UserPlaylistsEntity playlist = userPlaylistAppService.getSharedPlaylist(tokenOrId, userId);
        List<SongsEntity> songs = userPlaylistAppService.getSharedPlaylistSongsPaginated(tokenOrId, userId, page, size);
        PaginationMetaDataEntity metaData = userPlaylistAppService.getPlaylistSongsPaginationMetaData(playlist.getId());
        return ResponseEntity.ok(new PaginatedResponseDto<>(songs, page, size, metaData));
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

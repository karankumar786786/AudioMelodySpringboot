package me.one_org.melody.Controllers.Api;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Dto.Controllers.Api.AddSongToUserPlaylistRequestDto;
import me.one_org.melody.Dto.Controllers.Api.CreateUserPlaylistRequestDto;
import me.one_org.melody.Dto.Controllers.Api.PaginationMetaDataDto;
import me.one_org.melody.Dto.Controllers.Api.RenameUserPlaylistRequestDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Dto.Controllers.Api.UpdatePlaylistPrivacyRequestDto;
import me.one_org.melody.Dto.Controllers.Api.UserPlaylistDto;
import me.one_org.melody.Services.Api.UserPlaylistApiService;

@RestController
@RequestMapping("/api/user/playlists")
public class UserPlaylistApiController {

    private final UserPlaylistApiService userPlaylistAppService;

    public UserPlaylistApiController(UserPlaylistApiService userPlaylistAppService) {
        this.userPlaylistAppService = userPlaylistAppService;
    }

    @GetMapping
    public ResponseEntity<PaginatedResponseDto<UserPlaylistDto>> getUserPlaylists(
            @RequestAttribute("userId") String userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<UserPlaylistDto> playlists = userPlaylistAppService.getUserPlaylistsPaginated(userId, page, size);
        PaginationMetaDataDto metaData = userPlaylistAppService.getPaginationMetaData(userId);
        return ResponseEntity.ok(new PaginatedResponseDto<>(playlists, page, size, metaData));
    }

    @PostMapping
    public ResponseEntity<UserPlaylistDto> createPlaylist(
            @RequestAttribute("userId") String userId,
            @Valid @RequestBody CreateUserPlaylistRequestDto data) {
        return ResponseEntity.status(HttpStatus.CREATED).body(userPlaylistAppService.createPlaylist(userId, data.name(), data.privacy()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<UserPlaylistDto> renamePlaylist(
            @RequestAttribute("userId") String userId,
            @PathVariable String id,
            @Valid @RequestBody RenameUserPlaylistRequestDto data) {
        return ResponseEntity.ok(userPlaylistAppService.renamePlaylist(userId, id, data.name()));
    }

    @PatchMapping("/{id}/privacy")
    public ResponseEntity<UserPlaylistDto> updatePlaylistPrivacy(
            @RequestAttribute("userId") String userId,
            @PathVariable String id,
            @Valid @RequestBody UpdatePlaylistPrivacyRequestDto data) {
        return ResponseEntity.ok(userPlaylistAppService.updatePlaylistPrivacy(userId, id, data.privacy()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserPlaylistDto> getPlaylistById(
            @RequestAttribute(value = "userId", required = false) String userId,
            @PathVariable String id) {
        return ResponseEntity.ok(userPlaylistAppService.getPlaylistById(userId, id));
    }

    @GetMapping("/{id}/songs")
    public ResponseEntity<PaginatedResponseDto<SongDto>> getPlaylistSongs(
            @RequestAttribute(value = "userId", required = false) String userId,
            @PathVariable String id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<SongDto> songs = userPlaylistAppService.getPlaylistSongsPaginated(userId, id, page, size);
        PaginationMetaDataDto metaData = userPlaylistAppService.getPlaylistSongsPaginationMetaData(id);
        return ResponseEntity.ok(new PaginatedResponseDto<>(songs, page, size, metaData));
    }

    @PostMapping("/{id}/save")
    public ResponseEntity<UserPlaylistDto> savePlaylistToLibrary(
            @RequestAttribute("userId") String userId,
            @PathVariable String id) {
        return ResponseEntity.status(HttpStatus.CREATED).body(userPlaylistAppService.savePlaylistToLibrary(userId, id));
    }

    @DeleteMapping("/{id}/save")
    public ResponseEntity<Void> unsavePlaylistFromLibrary(
            @RequestAttribute("userId") String userId,
            @PathVariable String id) {
        userPlaylistAppService.unsavePlaylistFromLibrary(userId, id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/saved")
    public ResponseEntity<java.util.Map<String, Boolean>> isPlaylistSaved(
            @RequestAttribute(value = "userId", required = false) String userId,
            @PathVariable String id) {
        boolean saved = userPlaylistAppService.isPlaylistSaved(userId, id);
        return ResponseEntity.ok(java.util.Map.of("isSaved", saved));
    }

    @PostMapping("/{id}/duplicate")
    public ResponseEntity<UserPlaylistDto> duplicatePlaylist(
            @RequestAttribute("userId") String userId,
            @PathVariable String id) {
        return ResponseEntity.status(HttpStatus.CREATED).body(userPlaylistAppService.duplicatePlaylist(userId, id));
    }

    @GetMapping("/shared/{tokenOrId}")
    public ResponseEntity<UserPlaylistDto> getSharedPlaylist(
            @RequestAttribute(value = "userId", required = false) String userId,
            @PathVariable String tokenOrId) {
        return ResponseEntity.ok(userPlaylistAppService.getSharedPlaylist(tokenOrId, userId));
    }

    @GetMapping("/shared/{tokenOrId}/songs")
    public ResponseEntity<PaginatedResponseDto<SongDto>> getSharedPlaylistSongs(
            @RequestAttribute(value = "userId", required = false) String userId,
            @PathVariable String tokenOrId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        UserPlaylistDto playlist = userPlaylistAppService.getSharedPlaylist(tokenOrId, userId);
        List<SongDto> songs = userPlaylistAppService.getSharedPlaylistSongsPaginated(tokenOrId, userId, page, size);
        PaginationMetaDataDto metaData = userPlaylistAppService.getPlaylistSongsPaginationMetaData(playlist.id());
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
    public ResponseEntity<UserPlaylistDto> addSong(
            @RequestAttribute("userId") String userId,
            @PathVariable String id,
            @Valid @RequestBody AddSongToUserPlaylistRequestDto data) {
        return ResponseEntity.ok(userPlaylistAppService.addSong(userId, id, data.songId()));
    }

    @DeleteMapping("/{id}/songs/{songId}")
    public ResponseEntity<UserPlaylistDto> removeSong(
            @RequestAttribute("userId") String userId,
            @PathVariable String id,
            @PathVariable String songId) {
        return ResponseEntity.ok(userPlaylistAppService.removeSong(userId, id, songId));
    }
}

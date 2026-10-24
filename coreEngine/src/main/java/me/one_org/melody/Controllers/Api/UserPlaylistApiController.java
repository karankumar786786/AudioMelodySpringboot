package me.one_org.melody.Controllers.Api;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import org.springframework.validation.annotation.Validated;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Dto.Controllers.Api.AddSongToUserPlaylistRequestDto;
import me.one_org.melody.Dto.Controllers.Api.CreateUserPlaylistRequestDto;
import me.one_org.melody.Dto.Controllers.Api.PaginationMetaDataDto;
import me.one_org.melody.Dto.Controllers.Api.RenameUserPlaylistRequestDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Dto.Controllers.Api.UpdatePlaylistPrivacyRequestDto;
import me.one_org.melody.Dto.Controllers.Api.UserPlaylistDto;
import me.one_org.melody.Security.CurrentUser;
import me.one_org.melody.Security.CustomUserDetails;
import me.one_org.melody.Services.Api.UserPlaylistApiService;

@RestController
@RequestMapping("/api/user/playlists")
@Validated
public class UserPlaylistApiController {

    private final UserPlaylistApiService userPlaylistAppService;

    public UserPlaylistApiController(UserPlaylistApiService userPlaylistAppService) {
        this.userPlaylistAppService = userPlaylistAppService;
    }

    @GetMapping
    public ResponseEntity<PaginatedResponseDto<UserPlaylistDto>> getUserPlaylists(
            @CurrentUser CustomUserDetails currentUser,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<UserPlaylistDto> playlists = userPlaylistAppService.getUserPlaylistsPaginated(currentUser.getId(), page, size);
        PaginationMetaDataDto metaData = userPlaylistAppService.getPaginationMetaData(currentUser.getId());
        return ResponseEntity.ok(new PaginatedResponseDto<>(playlists, page, size, metaData));
    }

    @PostMapping
    public ResponseEntity<UserPlaylistDto> createPlaylist(
            @CurrentUser CustomUserDetails currentUser,
            @Valid @RequestBody CreateUserPlaylistRequestDto data) {
        return ResponseEntity.status(HttpStatus.CREATED).body(userPlaylistAppService.createPlaylist(currentUser.getId(), data.name(), data.privacy()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<UserPlaylistDto> renamePlaylist(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Playlist ID is required") String id,
            @Valid @RequestBody RenameUserPlaylistRequestDto data) {
        return ResponseEntity.ok(userPlaylistAppService.renamePlaylist(currentUser.getId(), id, data.name()));
    }

    @PatchMapping("/{id}/privacy")
    public ResponseEntity<UserPlaylistDto> updatePlaylistPrivacy(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Playlist ID is required") String id,
            @Valid @RequestBody UpdatePlaylistPrivacyRequestDto data) {
        return ResponseEntity.ok(userPlaylistAppService.updatePlaylistPrivacy(currentUser.getId(), id, data.privacy()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserPlaylistDto> getPlaylistById(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Playlist ID is required") String id) {
        String userId = currentUser != null ? currentUser.getId() : null;
        return ResponseEntity.ok(userPlaylistAppService.getPlaylistById(userId, id));
    }

    @GetMapping("/{id}/songs")
    public ResponseEntity<PaginatedResponseDto<SongDto>> getPlaylistSongs(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Playlist ID is required") String id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        String userId = currentUser != null ? currentUser.getId() : null;
        List<SongDto> songs = userPlaylistAppService.getPlaylistSongsPaginated(userId, id, page, size);
        PaginationMetaDataDto metaData = userPlaylistAppService.getPlaylistSongsPaginationMetaData(id);
        return ResponseEntity.ok(new PaginatedResponseDto<>(songs, page, size, metaData));
    }

    @PostMapping("/{id}/save")
    public ResponseEntity<UserPlaylistDto> savePlaylistToLibrary(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Playlist ID is required") String id) {
        return ResponseEntity.status(HttpStatus.CREATED).body(userPlaylistAppService.savePlaylistToLibrary(currentUser.getId(), id));
    }

    @DeleteMapping("/{id}/save")
    public ResponseEntity<Void> unsavePlaylistFromLibrary(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Playlist ID is required") String id) {
        userPlaylistAppService.unsavePlaylistFromLibrary(currentUser.getId(), id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/saved")
    public ResponseEntity<java.util.Map<String, Boolean>> isPlaylistSaved(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Playlist ID is required") String id) {
        String userId = currentUser != null ? currentUser.getId() : null;
        boolean saved = userPlaylistAppService.isPlaylistSaved(userId, id);
        return ResponseEntity.ok(java.util.Map.of("isSaved", saved));
    }

    @PostMapping("/{id}/duplicate")
    public ResponseEntity<UserPlaylistDto> duplicatePlaylist(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Playlist ID is required") String id) {
        return ResponseEntity.status(HttpStatus.CREATED).body(userPlaylistAppService.duplicatePlaylist(currentUser.getId(), id));
    }

    @GetMapping("/shared/{tokenOrId}")
    public ResponseEntity<UserPlaylistDto> getSharedPlaylist(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Share token or ID is required") String tokenOrId) {
        String userId = currentUser != null ? currentUser.getId() : null;
        return ResponseEntity.ok(userPlaylistAppService.getSharedPlaylist(tokenOrId, userId));
    }

    @GetMapping("/shared/{tokenOrId}/songs")
    public ResponseEntity<PaginatedResponseDto<SongDto>> getSharedPlaylistSongs(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Share token or ID is required") String tokenOrId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        String userId = currentUser != null ? currentUser.getId() : null;
        UserPlaylistDto playlist = userPlaylistAppService.getSharedPlaylist(tokenOrId, userId);
        List<SongDto> songs = userPlaylistAppService.getSharedPlaylistSongsPaginated(tokenOrId, userId, page, size);
        PaginationMetaDataDto metaData = userPlaylistAppService.getPlaylistSongsPaginationMetaData(playlist.id());
        return ResponseEntity.ok(new PaginatedResponseDto<>(songs, page, size, metaData));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePlaylist(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Playlist ID is required") String id) {
        userPlaylistAppService.deletePlaylist(currentUser.getId(), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/songs")
    public ResponseEntity<UserPlaylistDto> addSong(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Playlist ID is required") String id,
            @Valid @RequestBody AddSongToUserPlaylistRequestDto data) {
        return ResponseEntity.ok(userPlaylistAppService.addSong(currentUser.getId(), id, data.songId()));
    }

    @DeleteMapping("/{id}/songs/{songId}")
    public ResponseEntity<UserPlaylistDto> removeSong(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Playlist ID is required") String id,
            @PathVariable @NotBlank(message = "Song ID is required") String songId) {
        return ResponseEntity.ok(userPlaylistAppService.removeSong(currentUser.getId(), id, songId));
    }
}

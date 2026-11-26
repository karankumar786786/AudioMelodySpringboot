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

/**
 * User ki apni playlists ki API: banao, rename, privacy, songs jodo/hatao, save, duplicate, share link.
 * Doosre ki private playlist chhedne pe 403.
 *
 * Controller = HTTP request ka pehla stop. Ye sirf request padhta hai, service ko kaam deta hai,
 * aur response (JSON) lautata hai. Asli logic service me hai.
 */
@RestController
@RequestMapping("/api/user/playlists")
@Validated
public class UserPlaylistApiController {

    private final UserPlaylistApiService userPlaylistAppService;

    public UserPlaylistApiController(UserPlaylistApiService userPlaylistAppService) {
        this.userPlaylistAppService = userPlaylistAppService;
    }

    /** GET /api/user/playlists - user ki library (apni + saved playlists). */
    @GetMapping
    public ResponseEntity<PaginatedResponseDto<UserPlaylistDto>> getUserPlaylists(
            @CurrentUser CustomUserDetails currentUser,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<UserPlaylistDto> playlists = userPlaylistAppService.getUserPlaylistsPaginated(currentUser.getId(), page, size);
        PaginationMetaDataDto metaData = userPlaylistAppService.getPaginationMetaData(currentUser.getId());
        return ResponseEntity.ok(new PaginatedResponseDto<>(playlists, page, size, metaData));
    }

    /** POST /api/user/playlists - nayi playlist banao. */
    @PostMapping
    public ResponseEntity<UserPlaylistDto> createPlaylist(
            @CurrentUser CustomUserDetails currentUser,
            @Valid @RequestBody CreateUserPlaylistRequestDto data) {
        return ResponseEntity.status(HttpStatus.CREATED).body(userPlaylistAppService.createPlaylist(currentUser.getId(), data.name(), data.privacy()));
    }

    /** PUT /api/user/playlists/{id} - naam badlo (sirf owner). */
    @PutMapping("/{id}")
    public ResponseEntity<UserPlaylistDto> renamePlaylist(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Playlist ID is required") String id,
            @Valid @RequestBody RenameUserPlaylistRequestDto data) {
        return ResponseEntity.ok(userPlaylistAppService.renamePlaylist(currentUser.getId(), id, data.name()));
    }

    /** PATCH /api/user/playlists/{id}/privacy - PUBLIC / PRIVATE / SHARE_BY_LINK karo. */
    @PatchMapping("/{id}/privacy")
    public ResponseEntity<UserPlaylistDto> updatePlaylistPrivacy(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Playlist ID is required") String id,
            @Valid @RequestBody UpdatePlaylistPrivacyRequestDto data) {
        return ResponseEntity.ok(userPlaylistAppService.updatePlaylistPrivacy(currentUser.getId(), id, data.privacy()));
    }

    /** GET /api/user/playlists/{id} - ek playlist (dekhne ki permission ho to). */
    @GetMapping("/{id}")
    public ResponseEntity<UserPlaylistDto> getPlaylistById(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Playlist ID is required") String id) {
        String userId = currentUser != null ? currentUser.getId() : null;
        return ResponseEntity.ok(userPlaylistAppService.getPlaylistById(userId, id));
    }

    /** GET /api/user/playlists/{id}/songs - playlist ke songs. */
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

    /** POST /api/user/playlists/{id}/save - doosre ki playlist apni library me save karo. */
    @PostMapping("/{id}/save")
    public ResponseEntity<UserPlaylistDto> savePlaylistToLibrary(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Playlist ID is required") String id) {
        return ResponseEntity.status(HttpStatus.CREATED).body(userPlaylistAppService.savePlaylistToLibrary(currentUser.getId(), id));
    }

    /** DELETE /api/user/playlists/{id}/save - library se hatao (unsave). */
    @DeleteMapping("/{id}/save")
    public ResponseEntity<Void> unsavePlaylistFromLibrary(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Playlist ID is required") String id) {
        userPlaylistAppService.unsavePlaylistFromLibrary(currentUser.getId(), id);
        return ResponseEntity.noContent().build();
    }

    /** GET /api/user/playlists/{id}/saved - kya maine ye playlist save ki hai? */
    @GetMapping("/{id}/saved")
    public ResponseEntity<java.util.Map<String, Boolean>> isPlaylistSaved(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Playlist ID is required") String id) {
        String userId = currentUser != null ? currentUser.getId() : null;
        boolean saved = userPlaylistAppService.isPlaylistSaved(userId, id);
        return ResponseEntity.ok(java.util.Map.of("isSaved", saved));
    }

    /** POST /api/user/playlists/{id}/duplicate - playlist ki apni copy banao. */
    @PostMapping("/{id}/duplicate")
    public ResponseEntity<UserPlaylistDto> duplicatePlaylist(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Playlist ID is required") String id) {
        return ResponseEntity.status(HttpStatus.CREATED).body(userPlaylistAppService.duplicatePlaylist(currentUser.getId(), id));
    }

    /** GET /api/user/playlists/shared/{tokenOrId} - share link se playlist kholo. */
    @GetMapping("/shared/{tokenOrId}")
    public ResponseEntity<UserPlaylistDto> getSharedPlaylist(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Share token or ID is required") String tokenOrId) {
        String userId = currentUser != null ? currentUser.getId() : null;
        return ResponseEntity.ok(userPlaylistAppService.getSharedPlaylist(tokenOrId, userId));
    }

    /** GET /api/user/playlists/shared/{tokenOrId}/songs - share link wali playlist ke songs. */
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

    /** DELETE /api/user/playlists/{id} - playlist delete (sirf owner). */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePlaylist(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Playlist ID is required") String id) {
        userPlaylistAppService.deletePlaylist(currentUser.getId(), id);
        return ResponseEntity.noContent().build();
    }

    /** POST /api/user/playlists/{id}/songs - playlist me song jodo. */
    @PostMapping("/{id}/songs")
    public ResponseEntity<UserPlaylistDto> addSong(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Playlist ID is required") String id,
            @Valid @RequestBody AddSongToUserPlaylistRequestDto data) {
        return ResponseEntity.ok(userPlaylistAppService.addSong(currentUser.getId(), id, data.songId()));
    }

    /** DELETE /api/user/playlists/{id}/songs/{songId} - playlist se song hatao. */
    @DeleteMapping("/{id}/songs/{songId}")
    public ResponseEntity<UserPlaylistDto> removeSong(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Playlist ID is required") String id,
            @PathVariable @NotBlank(message = "Song ID is required") String songId) {
        return ResponseEntity.ok(userPlaylistAppService.removeSong(currentUser.getId(), id, songId));
    }
}

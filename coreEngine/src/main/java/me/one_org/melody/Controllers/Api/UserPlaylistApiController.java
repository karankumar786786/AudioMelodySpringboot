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
import me.one_org.melody.Entity.PaginationMetaData;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Entity.UserPlaylist;
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
        List<UserPlaylist> playlists = userPlaylistAppService.getUserPlaylistsPaginated(userId, page, size);
        List<UserPlaylistDto> dtos = playlists.stream().map(UserPlaylistDto::fromEntity).toList();
        PaginationMetaData metaData = userPlaylistAppService.getPaginationMetaData(userId);
        return ResponseEntity.ok(new PaginatedResponseDto<>(dtos, page, size, PaginationMetaDataDto.fromEntity(metaData)));
    }

    @PostMapping
    public ResponseEntity<UserPlaylistDto> createPlaylist(
            @RequestAttribute("userId") String userId,
            @Valid @RequestBody CreateUserPlaylistRequestDto data) {
        UserPlaylist playlist = userPlaylistAppService.createPlaylist(userId, data.name(), data.privacy());
        return ResponseEntity.status(HttpStatus.CREATED).body(UserPlaylistDto.fromEntity(playlist));
    }

    @PutMapping("/{id}")
    public ResponseEntity<UserPlaylistDto> renamePlaylist(
            @RequestAttribute("userId") String userId,
            @PathVariable String id,
            @Valid @RequestBody RenameUserPlaylistRequestDto data) {
        UserPlaylist playlist = userPlaylistAppService.renamePlaylist(userId, id, data.name());
        return ResponseEntity.ok(UserPlaylistDto.fromEntity(playlist));
    }

    @PatchMapping("/{id}/privacy")
    public ResponseEntity<UserPlaylistDto> updatePlaylistPrivacy(
            @RequestAttribute("userId") String userId,
            @PathVariable String id,
            @Valid @RequestBody UpdatePlaylistPrivacyRequestDto data) {
        UserPlaylist playlist = userPlaylistAppService.updatePlaylistPrivacy(userId, id, data.privacy());
        return ResponseEntity.ok(UserPlaylistDto.fromEntity(playlist));
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserPlaylistDto> getPlaylistById(
            @RequestAttribute(value = "userId", required = false) String userId,
            @PathVariable String id) {
        UserPlaylist playlist = userPlaylistAppService.getPlaylistById(userId, id);
        return ResponseEntity.ok(UserPlaylistDto.fromEntity(playlist));
    }

    @GetMapping("/{id}/songs")
    public ResponseEntity<PaginatedResponseDto<SongDto>> getPlaylistSongs(
            @RequestAttribute(value = "userId", required = false) String userId,
            @PathVariable String id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<Song> songs = userPlaylistAppService.getPlaylistSongsPaginated(userId, id, page, size);
        List<SongDto> dtos = songs.stream().map(SongDto::fromEntity).toList();
        PaginationMetaData metaData = userPlaylistAppService.getPlaylistSongsPaginationMetaData(id);
        return ResponseEntity.ok(new PaginatedResponseDto<>(dtos, page, size, PaginationMetaDataDto.fromEntity(metaData)));
    }

    @PostMapping("/{id}/save")
    public ResponseEntity<UserPlaylistDto> savePlaylistToLibrary(
            @RequestAttribute("userId") String userId,
            @PathVariable String id) {
        UserPlaylist playlist = userPlaylistAppService.savePlaylistToLibrary(userId, id);
        return ResponseEntity.status(HttpStatus.CREATED).body(UserPlaylistDto.fromEntity(playlist));
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
        UserPlaylist playlist = userPlaylistAppService.duplicatePlaylist(userId, id);
        return ResponseEntity.status(HttpStatus.CREATED).body(UserPlaylistDto.fromEntity(playlist));
    }

    @GetMapping("/shared/{tokenOrId}")
    public ResponseEntity<UserPlaylistDto> getSharedPlaylist(
            @RequestAttribute(value = "userId", required = false) String userId,
            @PathVariable String tokenOrId) {
        UserPlaylist playlist = userPlaylistAppService.getSharedPlaylist(tokenOrId, userId);
        return ResponseEntity.ok(UserPlaylistDto.fromEntity(playlist));
    }

    @GetMapping("/shared/{tokenOrId}/songs")
    public ResponseEntity<PaginatedResponseDto<SongDto>> getSharedPlaylistSongs(
            @RequestAttribute(value = "userId", required = false) String userId,
            @PathVariable String tokenOrId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        UserPlaylist playlist = userPlaylistAppService.getSharedPlaylist(tokenOrId, userId);
        List<Song> songs = userPlaylistAppService.getSharedPlaylistSongsPaginated(tokenOrId, userId, page, size);
        List<SongDto> dtos = songs.stream().map(SongDto::fromEntity).toList();
        PaginationMetaData metaData = userPlaylistAppService.getPlaylistSongsPaginationMetaData(playlist.getId());
        return ResponseEntity.ok(new PaginatedResponseDto<>(dtos, page, size, PaginationMetaDataDto.fromEntity(metaData)));
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
        UserPlaylist playlist = userPlaylistAppService.addSong(userId, id, data.songId());
        return ResponseEntity.ok(UserPlaylistDto.fromEntity(playlist));
    }

    @DeleteMapping("/{id}/songs/{songId}")
    public ResponseEntity<UserPlaylistDto> removeSong(
            @RequestAttribute("userId") String userId,
            @PathVariable String id,
            @PathVariable String songId) {
        UserPlaylist playlist = userPlaylistAppService.removeSong(userId, id, songId);
        return ResponseEntity.ok(UserPlaylistDto.fromEntity(playlist));
    }
}

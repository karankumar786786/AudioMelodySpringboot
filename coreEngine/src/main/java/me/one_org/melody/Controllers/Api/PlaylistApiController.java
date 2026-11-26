package me.one_org.melody.Controllers.Api;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import org.springframework.validation.annotation.Validated;
import jakarta.validation.constraints.NotBlank;
import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Dto.Controllers.Api.PaginationMetaDataDto;
import me.one_org.melody.Dto.Controllers.Api.PlaylistDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Services.Api.PlaylistApiService;

/**
 * Official playlists ki API (sirf padhna).
 *
 * Controller = HTTP request ka pehla stop. Ye sirf request padhta hai, service ko kaam deta hai,
 * aur response (JSON) lautata hai. Asli logic service me hai.
 */
@RestController
@RequestMapping("/api/playlists")
@Validated
public class PlaylistApiController {

    private final PlaylistApiService playlistAppService;

    public PlaylistApiController(PlaylistApiService playlistAppService) {
        this.playlistAppService = playlistAppService;
    }

    /** GET /api/playlists - saari playlists, page by page. */
    @GetMapping
    public ResponseEntity<PaginatedResponseDto<PlaylistDto>> getAllPlaylists(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<PlaylistDto> playlists = playlistAppService.getPlaylistsPaginated(page, size);
        PaginationMetaDataDto metaData = playlistAppService.getPaginationMetaData();
        return ResponseEntity.ok(new PaginatedResponseDto<>(playlists, page, size, metaData));
    }

    /** GET /api/playlists/{id} - ek playlist. */
    @GetMapping("/{id}")
    public ResponseEntity<PlaylistDto> getPlaylistById(@PathVariable @NotBlank(message = "Playlist ID is required") String id) {
        return ResponseEntity.ok(playlistAppService.getPlaylistById(id));
    }

    /** GET /api/playlists/{id}/songs - playlist ke songs, page by page. */
    @GetMapping("/{id}/songs")
    public ResponseEntity<PaginatedResponseDto<SongDto>> getPlaylistSongs(
            @PathVariable @NotBlank(message = "Playlist ID is required") String id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<SongDto> songs = playlistAppService.getPlaylistSongsPaginated(id, page, size);
        PaginationMetaDataDto metaData = playlistAppService.getPlaylistSongsPaginationMetaData(id);
        return ResponseEntity.ok(new PaginatedResponseDto<>(songs, page, size, metaData));
    }
}

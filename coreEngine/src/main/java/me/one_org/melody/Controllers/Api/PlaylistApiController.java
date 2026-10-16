package me.one_org.melody.Controllers.Api;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Dto.Controllers.Api.PaginationMetaDataDto;
import me.one_org.melody.Dto.Controllers.Api.PlaylistDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Services.Api.PlaylistApiService;

@RestController
@RequestMapping("/api/playlists")
public class PlaylistApiController {

    private final PlaylistApiService playlistAppService;

    public PlaylistApiController(PlaylistApiService playlistAppService) {
        this.playlistAppService = playlistAppService;
    }

    @GetMapping
    public ResponseEntity<PaginatedResponseDto<PlaylistDto>> getAllPlaylists(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<PlaylistDto> playlists = playlistAppService.getPlaylistsPaginated(page, size);
        PaginationMetaDataDto metaData = playlistAppService.getPaginationMetaData();
        return ResponseEntity.ok(new PaginatedResponseDto<>(playlists, page, size, metaData));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PlaylistDto> getPlaylistById(@PathVariable String id) {
        return ResponseEntity.ok(playlistAppService.getPlaylistById(id));
    }

    @GetMapping(value = {"/{id}/songs", "/{id}/backup-songs", "/{id}/fallback-songs"})
    public ResponseEntity<PaginatedResponseDto<SongDto>> getPlaylistSongs(
            @PathVariable String id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<SongDto> songs = playlistAppService.getPlaylistSongsPaginated(id, page, size);
        PaginationMetaDataDto metaData = playlistAppService.getPlaylistSongsPaginationMetaData(id);
        return ResponseEntity.ok(new PaginatedResponseDto<>(songs, page, size, metaData));
    }
}

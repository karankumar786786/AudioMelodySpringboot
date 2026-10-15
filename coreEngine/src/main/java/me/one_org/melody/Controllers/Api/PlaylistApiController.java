package me.one_org.melody.Controllers.Api;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Dto.Controllers.Api.PaginationMetaDataDto;
import me.one_org.melody.Dto.Controllers.Api.PlaylistDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Entity.PaginationMetaData;
import me.one_org.melody.Entity.Playlist;
import me.one_org.melody.Entity.Song;
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
        List<Playlist> playlists = playlistAppService.getPlaylistsPaginated(page, size);
        List<PlaylistDto> dtos = playlists.stream().map(PlaylistDto::fromEntity).toList();
        PaginationMetaData metaData = playlistAppService.getPaginationMetaData();
        return ResponseEntity.ok(new PaginatedResponseDto<>(dtos, page, size, PaginationMetaDataDto.fromEntity(metaData)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PlaylistDto> getPlaylistById(@PathVariable String id) {
        Playlist playlist = playlistAppService.getPlaylistById(id);
        return ResponseEntity.ok(PlaylistDto.fromEntity(playlist));
    }

    @GetMapping("/{id}/songs")
    public ResponseEntity<PaginatedResponseDto<SongDto>> getPlaylistSongs(
            @PathVariable String id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<Song> songs = playlistAppService.getPlaylistSongsPaginated(id, page, size);
        List<SongDto> dtos = songs.stream().map(SongDto::fromEntity).toList();
        PaginationMetaData metaData = playlistAppService.getPlaylistSongsPaginationMetaData(id);
        return ResponseEntity.ok(new PaginatedResponseDto<>(dtos, page, size, PaginationMetaDataDto.fromEntity(metaData)));
    }
}

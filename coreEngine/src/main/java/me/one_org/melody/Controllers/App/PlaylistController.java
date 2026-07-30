package me.one_org.melody.Controllers.App;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Entity.PlaylistsEntity;
import me.one_org.melody.Services.App.PlaylistAppService;

@RestController
@RequestMapping("/app/playlists")
public class PlaylistController {

    private final PlaylistAppService playlistAppService;

    public PlaylistController(PlaylistAppService playlistAppService) {
        this.playlistAppService = playlistAppService;
    }

    @GetMapping
    public ResponseEntity<PaginatedResponseDto<PlaylistsEntity>> getAllPlaylists(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<PlaylistsEntity> playlists = playlistAppService.getPlaylistsPaginated(page, size);
        PaginationMetaDataEntity metaData = playlistAppService.getPaginationMetaData();
        return ResponseEntity.ok(new PaginatedResponseDto<>(playlists, page, size, metaData));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PlaylistsEntity> getPlaylistById(@PathVariable String id) {
        return ResponseEntity.ok(playlistAppService.getPlaylistById(id));
    }
}

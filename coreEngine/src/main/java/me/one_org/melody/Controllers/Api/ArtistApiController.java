package me.one_org.melody.Controllers.Api;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Entity.ArtistsEntity;
import me.one_org.melody.Entity.PaginationMetaDataEntity;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Services.Api.ArtistApiService;

@RestController
@RequestMapping("/api/artists")
public class ArtistApiController {

    private final ArtistApiService artistAppService;

    public ArtistApiController(ArtistApiService artistAppService) {
        this.artistAppService = artistAppService;
    }

    @GetMapping
    public ResponseEntity<PaginatedResponseDto<ArtistsEntity>> getAllArtists(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<ArtistsEntity> artists = artistAppService.getArtistsPaginated(page, size);
        PaginationMetaDataEntity metaData = artistAppService.getPaginationMetaData();
        return ResponseEntity.ok(new PaginatedResponseDto<>(artists, page, size, metaData));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ArtistsEntity> getArtistById(@PathVariable String id) {
        return ResponseEntity.ok(artistAppService.getArtistById(id));
    }

    @GetMapping("/{id}/songs")
    public ResponseEntity<List<SongsEntity>> getArtistSongs(@PathVariable String id) {
        return ResponseEntity.ok(artistAppService.getArtistSongs(id));
    }

}

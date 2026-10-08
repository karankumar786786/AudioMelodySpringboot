package me.one_org.melody.Controllers.Api;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Dto.Controllers.Api.ArtistFollowStatusDto;
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
    public ResponseEntity<PaginatedResponseDto<SongsEntity>> getArtistSongs(
            @PathVariable String id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<SongsEntity> songs = artistAppService.getArtistSongsPaginated(id, page, size);
        PaginationMetaDataEntity metaData = artistAppService.getArtistSongsPaginationMetaData(id);
        return ResponseEntity.ok(new PaginatedResponseDto<>(songs, page, size, metaData));
    }

    @PostMapping("/{id}/follow")
    public ResponseEntity<ArtistFollowStatusDto> followArtist(
            @RequestAttribute("userId") String userId,
            @PathVariable String id) {
        return ResponseEntity.ok(artistAppService.followArtist(userId, id));
    }

    @PostMapping("/{id}/unfollow")
    public ResponseEntity<ArtistFollowStatusDto> unfollowArtist(
            @RequestAttribute("userId") String userId,
            @PathVariable String id) {
        return ResponseEntity.ok(artistAppService.unfollowArtist(userId, id));
    }

    @DeleteMapping("/{id}/follow")
    public ResponseEntity<ArtistFollowStatusDto> deleteFollowArtist(
            @RequestAttribute("userId") String userId,
            @PathVariable String id) {
        return ResponseEntity.ok(artistAppService.unfollowArtist(userId, id));
    }

    @GetMapping("/{id}/follow-status")
    public ResponseEntity<ArtistFollowStatusDto> getFollowStatus(
            @RequestAttribute(value = "userId", required = false) String userId,
            @PathVariable String id) {
        return ResponseEntity.ok(artistAppService.getFollowStatus(userId, id));
    }
}

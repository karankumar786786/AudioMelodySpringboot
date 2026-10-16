package me.one_org.melody.Controllers.Api;

import java.util.List;

import java.util.concurrent.TimeUnit;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Dto.Controllers.Api.ArtistDto;
import me.one_org.melody.Dto.Controllers.Api.ArtistFollowStatusDto;
import me.one_org.melody.Dto.Controllers.Api.PaginationMetaDataDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Entity.Artist;
import me.one_org.melody.Entity.PaginationMetaData;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Services.Api.ArtistApiService;

@RestController
@RequestMapping("/api/artists")
public class ArtistApiController {

    private final ArtistApiService artistAppService;

    public ArtistApiController(ArtistApiService artistAppService) {
        this.artistAppService = artistAppService;
    }

    @GetMapping
    public ResponseEntity<PaginatedResponseDto<ArtistDto>> getAllArtists(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<Artist> artists = artistAppService.getArtistsPaginated(page, size);
        List<ArtistDto> dtos = artists.stream().map(ArtistDto::fromEntity).toList();
        PaginationMetaData metaData = artistAppService.getPaginationMetaData();
        return ResponseEntity.ok(new PaginatedResponseDto<>(dtos, page, size, PaginationMetaDataDto.fromEntity(metaData)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ArtistDto> getArtistById(@PathVariable String id) {
        Artist artist = artistAppService.getArtistById(id);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(30, TimeUnit.MINUTES).cachePublic())
                .body(ArtistDto.fromEntity(artist));
    }

    @GetMapping("/{id}/songs")
    public ResponseEntity<PaginatedResponseDto<SongDto>> getArtistSongs(
            @PathVariable String id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<Song> songs = artistAppService.getArtistSongsPaginated(id, page, size);
        List<SongDto> dtos = songs.stream().map(SongDto::fromEntity).toList();
        PaginationMetaData metaData = artistAppService.getArtistSongsPaginationMetaData(id);
        return ResponseEntity.ok(new PaginatedResponseDto<>(dtos, page, size, PaginationMetaDataDto.fromEntity(metaData)));
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

    @GetMapping("/onboarding-list")
    public ResponseEntity<List<ArtistDto>> getOnboardingList(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "100") int size) {
        List<Artist> artists = artistAppService.getOnboardingArtists(page, size);
        return ResponseEntity.ok(artists.stream().map(ArtistDto::fromEntity).toList());
    }

    @GetMapping("/search")
    public ResponseEntity<List<ArtistDto>> searchArtists(
            @RequestParam(name = "q", required = false, defaultValue = "") String query) {
        List<Artist> artists = artistAppService.searchArtists(query);
        return ResponseEntity.ok(artists.stream().map(ArtistDto::fromEntity).toList());
    }

    @PostMapping("/onboarding")
    public ResponseEntity<java.util.Map<String, Object>> completeOnboarding(
            @RequestAttribute("userId") String userId,
            @jakarta.validation.Valid @RequestBody me.one_org.melody.Dto.Controllers.Api.ArtistOnboardingRequestDto request) {
        return ResponseEntity.ok(artistAppService.completeOnboarding(userId, request.artistIds()));
    }
}

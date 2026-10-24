package me.one_org.melody.Controllers.Api;

import java.util.List;

import java.util.concurrent.TimeUnit;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import org.springframework.validation.annotation.Validated;
import jakarta.validation.constraints.NotBlank;
import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Dto.Controllers.Api.ArtistDto;
import me.one_org.melody.Dto.Controllers.Api.ArtistFollowStatusDto;
import me.one_org.melody.Dto.Controllers.Api.PaginationMetaDataDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Security.CurrentUser;
import me.one_org.melody.Security.CustomUserDetails;
import me.one_org.melody.Services.Api.ArtistApiService;

@RestController
@RequestMapping("/api/artists")
@Validated
public class ArtistApiController {

    private final ArtistApiService artistAppService;

    public ArtistApiController(ArtistApiService artistAppService) {
        this.artistAppService = artistAppService;
    }

    @GetMapping
    public ResponseEntity<PaginatedResponseDto<ArtistDto>> getAllArtists(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<ArtistDto> artists = artistAppService.getArtistsPaginated(page, size);
        PaginationMetaDataDto metaData = artistAppService.getPaginationMetaData();
        return ResponseEntity.ok(new PaginatedResponseDto<>(artists, page, size, metaData));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ArtistDto> getArtistById(@PathVariable @NotBlank(message = "Artist ID is required") String id) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(30, TimeUnit.MINUTES).cachePublic())
                .body(artistAppService.getArtistById(id));
    }

    @GetMapping("/{id}/songs")
    public ResponseEntity<PaginatedResponseDto<SongDto>> getArtistSongs(
            @PathVariable @NotBlank(message = "Artist ID is required") String id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<SongDto> songs = artistAppService.getArtistSongsPaginated(id, page, size);
        PaginationMetaDataDto metaData = artistAppService.getArtistSongsPaginationMetaData(id);
        return ResponseEntity.ok(new PaginatedResponseDto<>(songs, page, size, metaData));
    }

    @PostMapping("/{id}/follow")
    public ResponseEntity<ArtistFollowStatusDto> followArtist(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Artist ID is required") String id) {
        return ResponseEntity.ok(artistAppService.followArtist(currentUser.getId(), id));
    }

    @PostMapping("/{id}/unfollow")
    public ResponseEntity<ArtistFollowStatusDto> unfollowArtist(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Artist ID is required") String id) {
        return ResponseEntity.ok(artistAppService.unfollowArtist(currentUser.getId(), id));
    }

    @DeleteMapping("/{id}/follow")
    public ResponseEntity<ArtistFollowStatusDto> deleteFollowArtist(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Artist ID is required") String id) {
        return ResponseEntity.ok(artistAppService.unfollowArtist(currentUser.getId(), id));
    }

    @GetMapping("/{id}/follow-status")
    public ResponseEntity<ArtistFollowStatusDto> getFollowStatus(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Artist ID is required") String id) {
        String userId = currentUser != null ? currentUser.getId() : null;
        return ResponseEntity.ok(artistAppService.getFollowStatus(userId, id));
    }

    @GetMapping("/onboarding-list")
    public ResponseEntity<List<ArtistDto>> getOnboardingList(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "100") int size) {
        return ResponseEntity.ok(artistAppService.getOnboardingArtists(page, size));
    }

    @GetMapping("/search")
    public ResponseEntity<List<ArtistDto>> searchArtists(
            @RequestParam(name = "q", required = false, defaultValue = "") String query) {
        return ResponseEntity.ok(artistAppService.searchArtists(query));
    }

    @PostMapping("/onboarding")
    public ResponseEntity<java.util.Map<String, Object>> completeOnboarding(
            @CurrentUser CustomUserDetails currentUser,
            @jakarta.validation.Valid @RequestBody me.one_org.melody.Dto.Controllers.Api.ArtistOnboardingRequestDto request) {
        return ResponseEntity.ok(artistAppService.completeOnboarding(currentUser.getId(), request.artistIds()));
    }
}

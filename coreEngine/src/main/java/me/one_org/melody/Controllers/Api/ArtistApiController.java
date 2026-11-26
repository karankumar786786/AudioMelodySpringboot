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

/**
 * Artists API: list, details, artist ke songs, follow / unfollow, onboarding.
 *
 * Controller = HTTP request ka pehla stop. Ye sirf request padhta hai, service ko kaam deta hai,
 * aur response (JSON) lautata hai. Asli logic service me hai.
 */
@RestController
@RequestMapping("/api/artists")
@Validated
public class ArtistApiController {

    private final ArtistApiService artistAppService;

    public ArtistApiController(ArtistApiService artistAppService) {
        this.artistAppService = artistAppService;
    }

    /** GET /api/artists?page=&size= - saare artists (followers ke order me), page by page. */
    @GetMapping
    public ResponseEntity<PaginatedResponseDto<ArtistDto>> getAllArtists(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<ArtistDto> artists = artistAppService.getArtistsPaginated(page, size);
        PaginationMetaDataDto metaData = artistAppService.getPaginationMetaData();
        return ResponseEntity.ok(new PaginatedResponseDto<>(artists, page, size, metaData));
    }

    /** GET /api/artists/{id} - ek artist ki details. Na mile to 404. */
    @GetMapping("/{id}")
    public ResponseEntity<ArtistDto> getArtistById(@PathVariable @NotBlank(message = "Artist ID is required") String id) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(30, TimeUnit.MINUTES).cachePublic())
                .body(artistAppService.getArtistById(id));
    }

    /** GET /api/artists/{id}/songs - artist ke songs, page by page. */
    @GetMapping("/{id}/songs")
    public ResponseEntity<PaginatedResponseDto<SongDto>> getArtistSongs(
            @PathVariable @NotBlank(message = "Artist ID is required") String id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<SongDto> songs = artistAppService.getArtistSongsPaginated(id, page, size);
        PaginationMetaDataDto metaData = artistAppService.getArtistSongsPaginationMetaData(id);
        return ResponseEntity.ok(new PaginatedResponseDto<>(songs, page, size, metaData));
    }

    /** POST /api/artists/{id}/follow - artist ko follow karo; naya followers count lautata hai. */
    @PostMapping("/{id}/follow")
    public ResponseEntity<ArtistFollowStatusDto> followArtist(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Artist ID is required") String id) {
        return ResponseEntity.ok(artistAppService.followArtist(currentUser.getId(), id));
    }

    /** POST /api/artists/{id}/unfollow - unfollow karo. */
    @PostMapping("/{id}/unfollow")
    public ResponseEntity<ArtistFollowStatusDto> unfollowArtist(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Artist ID is required") String id) {
        return ResponseEntity.ok(artistAppService.unfollowArtist(currentUser.getId(), id));
    }

    /** DELETE /api/artists/{id}/follow - unfollow ka doosra tareeka (same kaam). */
    @DeleteMapping("/{id}/follow")
    public ResponseEntity<ArtistFollowStatusDto> deleteFollowArtist(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Artist ID is required") String id) {
        return ResponseEntity.ok(artistAppService.unfollowArtist(currentUser.getId(), id));
    }

    /** GET /api/artists/{id}/follow-status - kya user follow karta hai + followers count. */
    @GetMapping("/{id}/follow-status")
    public ResponseEntity<ArtistFollowStatusDto> getFollowStatus(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable @NotBlank(message = "Artist ID is required") String id) {
        String userId = currentUser != null ? currentUser.getId() : null;
        return ResponseEntity.ok(artistAppService.getFollowStatus(userId, id));
    }

    /** GET /api/artists/onboarding-list - onboarding screen pe dikhane ke liye artists. */
    @GetMapping("/onboarding-list")
    public ResponseEntity<List<ArtistDto>> getOnboardingList(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "100") int size) {
        return ResponseEntity.ok(artistAppService.getOnboardingArtists(page, size));
    }

    /** GET /api/artists/search?q= - naam se artists dhoondo. */
    @GetMapping("/search")
    public ResponseEntity<List<ArtistDto>> searchArtists(
            @RequestParam(name = "q", required = false, defaultValue = "") String query) {
        return ResponseEntity.ok(artistAppService.searchArtists(query));
    }

    /** POST /api/artists/onboarding - onboarding me chune artists follow karo aur recommendations shuru karo. */
    @PostMapping("/onboarding")
    public ResponseEntity<java.util.Map<String, Object>> completeOnboarding(
            @CurrentUser CustomUserDetails currentUser,
            @jakarta.validation.Valid @RequestBody me.one_org.melody.Dto.Controllers.Api.ArtistOnboardingRequestDto request) {
        return ResponseEntity.ok(artistAppService.completeOnboarding(currentUser.getId(), request.artistIds()));
    }
}

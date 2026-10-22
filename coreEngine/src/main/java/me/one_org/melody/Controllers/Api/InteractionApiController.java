package me.one_org.melody.Controllers.Api;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import me.one_org.melody.Dto.Controllers.Api.PaginationMetaDataDto;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Dto.Controllers.Api.TrackPlayRequestDto;
import me.one_org.melody.Dto.Controllers.Api.TrackSearchPlayRequestDto;
import me.one_org.melody.Dto.Controllers.Api.TrackSkipRequestDto;
import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Security.CurrentUser;
import me.one_org.melody.Security.CustomUserDetails;
import me.one_org.melody.Services.Api.InteractionApiService;

import java.util.List;

@RestController
@RequestMapping("/api/interaction")
public class InteractionApiController {

    private final InteractionApiService interactionAppService;

    public InteractionApiController(InteractionApiService interactionAppService) {
        this.interactionAppService = interactionAppService;
    }

    @PostMapping("/play")
    public ResponseEntity<Void> trackPlay(
            @CurrentUser CustomUserDetails currentUser,
            @Valid @RequestBody TrackPlayRequestDto data) {
        interactionAppService.trackPlay(currentUser.getId(), data.songId(), data.percentage());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/skip")
    public ResponseEntity<Void> trackSkip(
            @CurrentUser CustomUserDetails currentUser,
            @Valid @RequestBody TrackSkipRequestDto data) {
        interactionAppService.trackSkip(currentUser.getId(), data.songId());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/search-play")
    public ResponseEntity<Void> trackSearchPlay(
            @CurrentUser CustomUserDetails currentUser,
            @Valid @RequestBody TrackSearchPlayRequestDto data) {
        String userId = currentUser != null ? currentUser.getId() : null;
        interactionAppService.trackSearchPlay(userId, data.songId());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/search-click")
    public ResponseEntity<Void> trackSearchClick(
            @CurrentUser CustomUserDetails currentUser,
            @RequestBody java.util.Map<String, String> data) {
        String userId = currentUser != null ? currentUser.getId() : null;
        String type = data.get("type");
        String id = data.get("id");
        if (id != null && type != null) {
            interactionAppService.trackSearchClick(userId, type, id);
        }
        return ResponseEntity.ok().build();
    }

    @PostMapping("/queue-add")
    public ResponseEntity<Void> trackQueueAdd(
            @CurrentUser CustomUserDetails currentUser,
            @Valid @RequestBody TrackSearchPlayRequestDto data) {
        if (currentUser != null) {
            interactionAppService.trackQueueAdd(currentUser.getId(), data.songId());
        }
        return ResponseEntity.ok().build();
    }

    @PostMapping("/queue-remove")
    public ResponseEntity<Void> trackQueueRemove(
            @CurrentUser CustomUserDetails currentUser,
            @Valid @RequestBody TrackSearchPlayRequestDto data) {
        if (currentUser != null) {
            interactionAppService.trackQueueRemove(currentUser.getId(), data.songId());
        }
        return ResponseEntity.ok().build();
    }

    @PostMapping("/dislike")
    public ResponseEntity<Void> trackDislike(
            @CurrentUser CustomUserDetails currentUser,
            @Valid @RequestBody TrackSkipRequestDto data) {
        if (currentUser != null) {
            interactionAppService.trackDislike(currentUser.getId(), data.songId());
        }
        return ResponseEntity.ok().build();
    }

    @PostMapping("/share")
    public ResponseEntity<Void> trackShare(
            @CurrentUser CustomUserDetails currentUser,
            @Valid @RequestBody TrackSkipRequestDto data) {
        if (currentUser != null) {
            interactionAppService.trackShare(currentUser.getId(), data.songId());
        }
        return ResponseEntity.ok().build();
    }

    @PostMapping("/favourite/{songId}")
    public ResponseEntity<Void> addFavourite(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable String songId) {
        interactionAppService.addFavourite(currentUser.getId(), songId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/favourite/{songId}")
    public ResponseEntity<Void> removeFavourite(
            @CurrentUser CustomUserDetails currentUser,
            @PathVariable String songId) {
        interactionAppService.removeFavourite(currentUser.getId(), songId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/favourites")
    public ResponseEntity<PaginatedResponseDto<SongDto>> getFavourites(
            @CurrentUser CustomUserDetails currentUser,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<SongDto> favourites = interactionAppService.getFavouritesPaginated(currentUser.getId(), page, size);
        PaginationMetaDataDto metaData = interactionAppService.getFavouritesPaginationMetaData(currentUser.getId());
        return ResponseEntity.ok(new PaginatedResponseDto<>(favourites, page, size, metaData));
    }
}

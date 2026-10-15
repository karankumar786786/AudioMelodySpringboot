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
import me.one_org.melody.Entity.PaginationMetaData;
import me.one_org.melody.Entity.Song;
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
            @RequestAttribute("userId") String userId,
            @Valid @RequestBody TrackPlayRequestDto data) {
        interactionAppService.trackPlay(userId, data.songId(), data.percentage());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/skip")
    public ResponseEntity<Void> trackSkip(
            @RequestAttribute("userId") String userId,
            @Valid @RequestBody TrackSkipRequestDto data) {
        interactionAppService.trackSkip(userId, data.songId());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/search-play")
    public ResponseEntity<Void> trackSearchPlay(
            @RequestAttribute(value = "userId", required = false) String userId,
            @Valid @RequestBody TrackSearchPlayRequestDto data) {
        interactionAppService.trackSearchPlay(userId, data.songId());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/search-click")
    public ResponseEntity<Void> trackSearchClick(
            @RequestAttribute(value = "userId", required = false) String userId,
            @RequestBody java.util.Map<String, String> data) {
        String type = data.get("type");
        String id = data.get("id");
        if (id != null && type != null) {
            interactionAppService.trackSearchClick(userId, type, id);
        }
        return ResponseEntity.ok().build();
    }

    @PostMapping("/queue-add")
    public ResponseEntity<Void> trackQueueAdd(
            @RequestAttribute(value = "userId", required = false) String userId,
            @Valid @RequestBody TrackSearchPlayRequestDto data) {
        if (userId != null) {
            interactionAppService.trackQueueAdd(userId, data.songId());
        }
        return ResponseEntity.ok().build();
    }

    @PostMapping("/queue-remove")
    public ResponseEntity<Void> trackQueueRemove(
            @RequestAttribute(value = "userId", required = false) String userId,
            @Valid @RequestBody TrackSearchPlayRequestDto data) {
        if (userId != null) {
            interactionAppService.trackQueueRemove(userId, data.songId());
        }
        return ResponseEntity.ok().build();
    }

    @PostMapping("/dislike")
    public ResponseEntity<Void> trackDislike(
            @RequestAttribute(value = "userId", required = false) String userId,
            @Valid @RequestBody TrackSkipRequestDto data) {
        if (userId != null) {
            interactionAppService.trackDislike(userId, data.songId());
        }
        return ResponseEntity.ok().build();
    }

    @PostMapping("/share")
    public ResponseEntity<Void> trackShare(
            @RequestAttribute(value = "userId", required = false) String userId,
            @Valid @RequestBody TrackSkipRequestDto data) {
        if (userId != null) {
            interactionAppService.trackShare(userId, data.songId());
        }
        return ResponseEntity.ok().build();
    }

    @PostMapping("/favourite/{songId}")
    public ResponseEntity<Void> addFavourite(
            @RequestAttribute("userId") String userId,
            @PathVariable String songId) {
        interactionAppService.addFavourite(userId, songId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/favourite/{songId}")
    public ResponseEntity<Void> removeFavourite(
            @RequestAttribute("userId") String userId,
            @PathVariable String songId) {
        interactionAppService.removeFavourite(userId, songId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/favourites")
    public ResponseEntity<PaginatedResponseDto<SongDto>> getFavourites(
            @RequestAttribute("userId") String userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<Song> favourites = interactionAppService.getFavouritesPaginated(userId, page, size);
        List<SongDto> dtos = favourites.stream().map(SongDto::fromEntity).toList();
        PaginationMetaData metaData = interactionAppService.getFavouritesPaginationMetaData(userId);
        return ResponseEntity.ok(new PaginatedResponseDto<>(dtos, page, size, PaginationMetaDataDto.fromEntity(metaData)));
    }
}

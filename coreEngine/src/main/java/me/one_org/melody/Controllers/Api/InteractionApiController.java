package me.one_org.melody.Controllers.Api;


import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import me.one_org.melody.Dto.Controllers.Api.TrackPlayRequestDto;
import me.one_org.melody.Dto.Controllers.Api.TrackSkipRequestDto;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Services.Api.InteractionApiService;

import java.util.List;
import me.one_org.melody.Dto.Controllers.PaginatedResponseDto;
import me.one_org.melody.Entity.PaginationMetaDataEntity;

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
    public ResponseEntity<PaginatedResponseDto<SongsEntity>> getFavourites(
            @RequestAttribute("userId") String userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<SongsEntity> favourites = interactionAppService.getFavouritesPaginated(userId, page, size);
        PaginationMetaDataEntity metaData = interactionAppService.getFavouritesPaginationMetaData(userId);
        return ResponseEntity.ok(new PaginatedResponseDto<>(favourites, page, size, metaData));
    }
}

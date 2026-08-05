package me.one_org.melody.Controllers.Api;

import java.util.Set;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import me.one_org.melody.Dto.Controllers.Api.TrackPlayRequestDto;
import me.one_org.melody.Dto.Controllers.Api.TrackSkipRequestDto;
import me.one_org.melody.Entity.SongsEntity;
import me.one_org.melody.Services.Api.InteractionApiService;

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
    public ResponseEntity<Set<SongsEntity>> getFavourites(
            @RequestAttribute("userId") String userId) {
        return ResponseEntity.ok(interactionAppService.getFavourites(userId));
    }
}

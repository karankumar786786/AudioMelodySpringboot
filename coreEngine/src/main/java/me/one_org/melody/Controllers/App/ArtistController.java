package me.one_org.melody.Controllers.App;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import me.one_org.melody.Entity.ArtistsEntity;
import me.one_org.melody.Services.App.ArtistAppService;

@RestController
@RequestMapping("/app/artists")
public class ArtistController {

    private final ArtistAppService artistAppService;

    public ArtistController(ArtistAppService artistAppService) {
        this.artistAppService = artistAppService;
    }

    @GetMapping
    public ResponseEntity<List<ArtistsEntity>> getAllArtists() {
        return ResponseEntity.ok(artistAppService.getAllArtists());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ArtistsEntity> getArtistById(@PathVariable String id) {
        return ResponseEntity.ok(artistAppService.getArtistById(id));
    }
}

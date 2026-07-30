package me.one_org.melody.Controllers.Admin;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import me.one_org.melody.Dto.Controllers.Admin.CreateArtistRequestDto;
import me.one_org.melody.Dto.Controllers.Admin.UpdateArtistRequestDto;
import me.one_org.melody.Entity.ArtistsEntity;
import me.one_org.melody.Services.Genral.ArtistService;

@RestController
@RequestMapping("/admin/artist")
public class ArtistController {

    private final ArtistService artistService;

    public ArtistController(ArtistService artistService) {
        this.artistService = artistService;
    }

    @PostMapping
    public ResponseEntity<ArtistsEntity> createArtist(@Valid @RequestBody CreateArtistRequestDto data) {
        return ResponseEntity.status(HttpStatus.CREATED).body(artistService.createArtist(data));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ArtistsEntity> updateArtist(@PathVariable String id,
                                                       @Valid @RequestBody UpdateArtistRequestDto data) {
        return ResponseEntity.ok(artistService.updateArtist(id, data));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteArtist(@PathVariable String id) {
        artistService.deleteArtist(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    public ResponseEntity<List<ArtistsEntity>> getAllArtists() {
        return ResponseEntity.ok(artistService.getAllArtists());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ArtistsEntity> getArtistById(@PathVariable String id) {
        return ResponseEntity.ok(artistService.getArtistById(id));
    }
}

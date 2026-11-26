package me.one_org.melody.Controllers.Api;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Security.CurrentUser;
import me.one_org.melody.Security.CustomUserDetails;
import me.one_org.melody.Services.Api.UserGenrePreferenceService;



/**
 * Naye user ke genres (onboarding) ki API. Shuru me user ki history nahi hoti ("cold start"),
 * tab recommendations inhi genres se bante hain.
 * POST /api/preferences/genres - chune hue genres save karo (register ke baad)
 * GET  /api/preferences/genres - abhi ke genres lao
 */
@RestController
@RequestMapping("/api/preferences")
@Validated
@Slf4j
public class UserGenrePreferenceController {

    private final UserGenrePreferenceService service;

    public UserGenrePreferenceController(UserGenrePreferenceService service) {
        this.service = service;
    }

    record GenrePreferenceRequest(
            @NotEmpty
            @Size(max = UserGenrePreferenceService.MAX_GENRES)
            List<@NotBlank
                 @Size(max = UserGenrePreferenceService.MAX_GENRE_LENGTH)
                 @Pattern(regexp = "[^,]+", message = "must not contain commas") String> genres) {}
    record GenrePreferenceResponse(List<String> genres) {}

    /** Genres save karo (purane replace ho jaate hain). */
    @PostMapping("/genres")
    public ResponseEntity<Void> saveGenres(
            @CurrentUser CustomUserDetails currentUser,
            @RequestBody @Valid GenrePreferenceRequest body) {
        if (currentUser == null) return ResponseEntity.status(401).build();
        service.savePreferences(currentUser.getId(), body.genres());
        return ResponseEntity.ok().build();
    }

    /** User ke abhi ke genres. */
    @GetMapping("/genres")
    public ResponseEntity<GenrePreferenceResponse> getGenres(
            @CurrentUser CustomUserDetails currentUser) {
        if (currentUser == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(new GenrePreferenceResponse(
                service.getPreferences(currentUser.getId())));
    }
}


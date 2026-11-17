package me.one_org.melody.Controllers.Api;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Security.CurrentUser;
import me.one_org.melody.Security.CustomUserDetails;
import me.one_org.melody.Services.Api.UserGenrePreferenceService;

/**
 * P6: Cold-start genre onboarding endpoints.
 * POST /api/preferences/genres  — save selected genres (after registration)
 * GET  /api/preferences/genres  — fetch current preferences
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

    record GenrePreferenceRequest(@NotEmpty List<String> genres) {}
    record GenrePreferenceResponse(List<String> genres) {}

    @PostMapping("/genres")
    public ResponseEntity<Void> saveGenres(
            @CurrentUser CustomUserDetails currentUser,
            @RequestBody @Valid GenrePreferenceRequest body) {
        if (currentUser == null) return ResponseEntity.status(401).build();
        service.savePreferences(currentUser.getId(), body.genres());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/genres")
    public ResponseEntity<GenrePreferenceResponse> getGenres(
            @CurrentUser CustomUserDetails currentUser) {
        if (currentUser == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(new GenrePreferenceResponse(
                service.getPreferences(currentUser.getId())));
    }
}


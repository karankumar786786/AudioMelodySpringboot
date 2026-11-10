package me.one_org.melody.Controllers.Api;

import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import me.one_org.melody.Dto.Controllers.Api.UpdateProgressRequestDto;
import me.one_org.melody.Dto.Controllers.Api.UserProgressDto;
import me.one_org.melody.Security.CurrentUser;
import me.one_org.melody.Security.CustomUserDetails;
import me.one_org.melody.Services.Api.UserProgressApiService;

@RestController
@RequestMapping("/api/user/progress")
@Validated
public class UserProgressApiController {

    private final UserProgressApiService progressApiService;

    public UserProgressApiController(UserProgressApiService progressApiService) {
        this.progressApiService = progressApiService;
    }

    /**
     * Save playback progress for cross-device synchronization and resume.
     */
    @PostMapping
    public ResponseEntity<UserProgressDto> updateProgress(
            @CurrentUser CustomUserDetails currentUser,
            @Valid @RequestBody UpdateProgressRequestDto request
    ) {
        UserProgressDto progress = progressApiService.saveProgress(currentUser.getId(), request);
        return ResponseEntity.ok(progress);
    }

    /**
     * Get the last playback state to resume listening across devices.
     */
    @GetMapping("/resume")
    public ResponseEntity<UserProgressDto> getProgress(
            @CurrentUser CustomUserDetails currentUser
    ) {
        UserProgressDto progress = progressApiService.getProgress(currentUser.getId());
        if (progress == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(progress);
    }

    /**
     * Clear playback progress when queue finishes or user clears session.
     */
    @DeleteMapping
    public ResponseEntity<Void> clearProgress(
            @CurrentUser CustomUserDetails currentUser
    ) {
        progressApiService.clearProgress(currentUser.getId());
        return ResponseEntity.ok().build();
    }
}


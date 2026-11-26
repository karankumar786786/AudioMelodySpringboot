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

/**
 * Playback progress (resume) ki API - app band karke kholo to wahin se gaana chale, doosre device pe bhi.
 *
 * Controller = HTTP request ka pehla stop. Ye sirf request padhta hai, service ko kaam deta hai,
 * aur response (JSON) lautata hai. Asli logic service me hai.
 */
@RestController
@RequestMapping("/api/user/progress")
@Validated
public class UserProgressApiController {

    private final UserProgressApiService progressApiService;

    public UserProgressApiController(UserProgressApiService progressApiService) {
        this.progressApiService = progressApiService;
    }

    /** POST /api/user/progress - gaana kahan tak suna, save karo (resume aur doosre device ke liye). */
    @PostMapping
    public ResponseEntity<UserProgressDto> updateProgress(
            @CurrentUser CustomUserDetails currentUser,
            @Valid @RequestBody UpdateProgressRequestDto request
    ) {
        UserProgressDto progress = progressApiService.saveProgress(currentUser.getId(), request);
        return ResponseEntity.ok(progress);
    }

    /** GET /api/user/progress/resume - aakhri baar kya aur kahan tak baj raha tha. Kuch na ho to 204. */
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

    /** DELETE /api/user/progress - progress saaf karo (queue khatam ya user ne clear kiya). */
    @DeleteMapping
    public ResponseEntity<Void> clearProgress(
            @CurrentUser CustomUserDetails currentUser
    ) {
        progressApiService.clearProgress(currentUser.getId());
        return ResponseEntity.ok().build();
    }
}


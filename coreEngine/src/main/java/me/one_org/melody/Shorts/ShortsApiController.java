package me.one_org.melody.Shorts;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import me.one_org.melody.Exceptions.UnauthorizedException;
import me.one_org.melody.Security.CurrentUser;
import me.one_org.melody.Security.CustomUserDetails;

/** Shorts: standalone vertical videos with their own audio, optionally linked to a song. */
@RestController
@RequestMapping("/api/shorts")
@Validated
public class ShortsApiController {

    private final ShortsService shorts;

    public ShortsApiController(ShortsService shorts) {
        this.shorts = shorts;
    }

    private static String user(CustomUserDetails u) {
        if (u == null) throw new UnauthorizedException("Login required");
        return u.getId();
    }

    @GetMapping("/feed")
    public ShortDtos.Page feed(@CurrentUser CustomUserDetails u,
                               @RequestParam(defaultValue = "foryou") String sort,
                               @RequestParam(required = false) String cursor,
                               @RequestParam(defaultValue = "10") int size) {
        return shorts.feed(user(u), sort, cursor, size);
    }

    @GetMapping("/mine")
    public ShortDtos.Page mine(@CurrentUser CustomUserDetails u,
                               @RequestParam(required = false) String cursor,
                               @RequestParam(defaultValue = "20") int size) {
        String me = user(u);
        return shorts.byUser(me, me, cursor, size);
    }

    @GetMapping("/liked")
    public ShortDtos.Page liked(@CurrentUser CustomUserDetails u,
                                @RequestParam(required = false) String cursor,
                                @RequestParam(defaultValue = "20") int size) {
        return shorts.liked(user(u), cursor, size);
    }

    @GetMapping("/user/{userId}")
    public ShortDtos.Page byUser(@CurrentUser CustomUserDetails u, @PathVariable String userId,
                                 @RequestParam(required = false) String cursor,
                                 @RequestParam(defaultValue = "20") int size) {
        return shorts.byUser(userId, user(u), cursor, size);
    }

    @GetMapping("/song/{songId}")
    public ShortDtos.Page bySong(@CurrentUser CustomUserDetails u, @PathVariable String songId,
                                 @RequestParam(required = false) String cursor,
                                 @RequestParam(defaultValue = "20") int size) {
        return shorts.bySong(songId, user(u), cursor, size);
    }

    @PostMapping("/uploads")
    public ResponseEntity<ShortDtos.UploadResponse> startUpload(@CurrentUser CustomUserDetails u,
                                                                @Valid @RequestBody ShortDtos.UploadRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(shorts.startUpload(user(u), body));
    }

    @PostMapping("/views")
    public ResponseEntity<Void> views(@CurrentUser CustomUserDetails u, @Valid @RequestBody ShortDtos.ViewBatch body) {
        user(u);
        shorts.recordViews(body);
        return ResponseEntity.accepted().build();
    }

    @GetMapping("/{id}")
    public ShortDtos.Short get(@CurrentUser CustomUserDetails u, @PathVariable String id) {
        return shorts.get(id, user(u));
    }

    @PostMapping("/{id}/complete")
    public ShortDtos.Short complete(@CurrentUser CustomUserDetails u, @PathVariable String id) {
        return shorts.completeUpload(id, user(u));
    }

    @PatchMapping("/{id}")
    public ShortDtos.Short update(@CurrentUser CustomUserDetails u, @PathVariable String id,
                                  @Valid @RequestBody ShortDtos.UpdateRequest body) {
        return shorts.update(id, user(u), body);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@CurrentUser CustomUserDetails u, @PathVariable String id) {
        shorts.delete(id, user(u));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/like")
    public ShortDtos.LikeStatus like(@CurrentUser CustomUserDetails u, @PathVariable String id) {
        return shorts.like(id, user(u));
    }

    @DeleteMapping("/{id}/like")
    public ShortDtos.LikeStatus unlike(@CurrentUser CustomUserDetails u, @PathVariable String id) {
        return shorts.unlike(id, user(u));
    }

    @PostMapping("/{id}/report")
    public ResponseEntity<Void> report(@CurrentUser CustomUserDetails u, @PathVariable String id,
                                       @Valid @RequestBody ShortDtos.ReportRequest body) {
        shorts.report(id, user(u), body);
        return ResponseEntity.accepted().build();
    }
}

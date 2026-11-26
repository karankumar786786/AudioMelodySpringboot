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

/**
 * Shorts ki API (/api/shorts): khade (9:16) chhote videos apni awaaz ke saath, optional kisi gaane se jude.
 * Feed, upload, like, report, views. Controller sirf ShortsService ko kaam deta hai.
 */
@RestController
@RequestMapping("/api/shorts")
@Validated
public class ShortsApiController {

    private final ShortsService shorts;

    public ShortsApiController(ShortsService shorts) {
        this.shorts = shorts;
    }

    /** Logged-in user ki id (login na ho to null - feed bina login ke bhi chalti hai). */
    private static String user(CustomUserDetails u) {
        if (u == null) throw new UnauthorizedException("Login required");
        return u.getId();
    }

    /** GET /api/shorts/feed?sort=foryou|latest|popular&cursor=&size= - shorts feed. */
    @GetMapping("/feed")
    public ShortDtos.Page feed(@CurrentUser CustomUserDetails u,
                               @RequestParam(defaultValue = "foryou") String sort,
                               @RequestParam(required = false) String cursor,
                               @RequestParam(defaultValue = "10") int size) {
        return shorts.feed(user(u), sort, cursor, size);
    }

    /** GET /api/shorts/mine - mere shorts (processing / failed / hidden bhi). */
    @GetMapping("/mine")
    public ShortDtos.Page mine(@CurrentUser CustomUserDetails u,
                               @RequestParam(required = false) String cursor,
                               @RequestParam(defaultValue = "20") int size) {
        String me = user(u);
        return shorts.byUser(me, me, cursor, size);
    }

    /** GET /api/shorts/liked - maine jo like kiye. */
    @GetMapping("/liked")
    public ShortDtos.Page liked(@CurrentUser CustomUserDetails u,
                                @RequestParam(required = false) String cursor,
                                @RequestParam(defaultValue = "20") int size) {
        return shorts.liked(user(u), cursor, size);
    }

    /** GET /api/shorts/user/{userId} - kisi user ke shorts. */
    @GetMapping("/user/{userId}")
    public ShortDtos.Page byUser(@CurrentUser CustomUserDetails u, @PathVariable String userId,
                                 @RequestParam(required = false) String cursor,
                                 @RequestParam(defaultValue = "20") int size) {
        return shorts.byUser(userId, user(u), cursor, size);
    }

    /** GET /api/shorts/song/{songId} - is gaane wale shorts. */
    @GetMapping("/song/{songId}")
    public ShortDtos.Page bySong(@CurrentUser CustomUserDetails u, @PathVariable String songId,
                                 @RequestParam(required = false) String cursor,
                                 @RequestParam(defaultValue = "20") int size) {
        return shorts.bySong(songId, user(u), cursor, size);
    }

    /** POST /api/shorts/uploads - upload shuru: presigned URL lo (201). */
    @PostMapping("/uploads")
    public ResponseEntity<ShortDtos.UploadResponse> startUpload(@CurrentUser CustomUserDetails u,
                                                                @Valid @RequestBody ShortDtos.UploadRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(shorts.startUpload(user(u), body));
    }

    /** POST /api/shorts/views - views ka batch (202). */
    @PostMapping("/views")
    public ResponseEntity<Void> views(@CurrentUser CustomUserDetails u, @Valid @RequestBody ShortDtos.ViewBatch body) {
        user(u);
        shorts.recordViews(body);
        return ResponseEntity.accepted().build();
    }

    /** GET /api/shorts/{id} - ek short. */
    @GetMapping("/{id}")
    public ShortDtos.Short get(@CurrentUser CustomUserDetails u, @PathVariable String id) {
        return shorts.get(id, user(u));
    }

    /** POST /api/shorts/{id}/complete - S3 upload ho gaya: processing shuru karo. */
    @PostMapping("/{id}/complete")
    public ShortDtos.Short complete(@CurrentUser CustomUserDetails u, @PathVariable String id) {
        return shorts.completeUpload(id, user(u));
    }

    /** PATCH /api/shorts/{id} - caption / song badlo (sirf owner). */
    @PatchMapping("/{id}")
    public ShortDtos.Short update(@CurrentUser CustomUserDetails u, @PathVariable String id,
                                  @Valid @RequestBody ShortDtos.UpdateRequest body) {
        return shorts.update(id, user(u), body);
    }

    /** DELETE /api/shorts/{id} - apna short delete (204). */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@CurrentUser CustomUserDetails u, @PathVariable String id) {
        shorts.delete(id, user(u));
        return ResponseEntity.noContent().build();
    }

    /** POST /api/shorts/{id}/like - like. */
    @PostMapping("/{id}/like")
    public ShortDtos.LikeStatus like(@CurrentUser CustomUserDetails u, @PathVariable String id) {
        return shorts.like(id, user(u));
    }

    /** DELETE /api/shorts/{id}/like - unlike. */
    @DeleteMapping("/{id}/like")
    public ShortDtos.LikeStatus unlike(@CurrentUser CustomUserDetails u, @PathVariable String id) {
        return shorts.unlike(id, user(u));
    }

    /** POST /api/shorts/{id}/report - report karo (202). */
    @PostMapping("/{id}/report")
    public ResponseEntity<Void> report(@CurrentUser CustomUserDetails u, @PathVariable String id,
                                       @Valid @RequestBody ShortDtos.ReportRequest body) {
        shorts.report(id, user(u), body);
        return ResponseEntity.accepted().build();
    }
}

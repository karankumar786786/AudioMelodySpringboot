package me.one_org.melody.Shorts;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Exceptions.BadRequestException;
import me.one_org.melody.Exceptions.ForbiddenException;
import me.one_org.melody.Exceptions.ResourceNotFoundException;
import me.one_org.melody.Services.Authentication.RateLimiterService;

/**
 * Listeners wale shorts ka logic: feed, upload, like, report, views.
 *
 * Upload flow:
 * 1. startUpload: check (MP4/MOV, max 100 MB, ban nahi, 5/din) -> row UPLOADING -> presigned URL
 * 2. App seedha S3 (temp bucket, shorts-raw/...) me video PUT karta hai
 * 3. completeUpload: row PROCESSING -> Inngest "shorts/process" event
 * 4. Media pipeline transcode karti hai aur admin API ke webhook se short READY ho jaata hai
 * Processing ka status admin API sambhalta hai (media pipeline usi ko report karti hai).
 */
@Service
@Slf4j
public class ShortsService {

    static final Set<String> CONTENT_TYPES = Set.of("video/mp4", "video/quicktime");
    static final Set<String> REPORT_REASONS = Set.of("SPAM", "NUDITY", "VIOLENCE", "HATE", "COPYRIGHT", "OTHER");
    static final int MAX_PAGE = 30;

    private final ShortsRepository repo;
    private final ShortStorage storage;
    private final ShortEvents events;
    private final RateLimiterService rateLimiter;
    private final ShortsProperties props;

    public ShortsService(ShortsRepository repo, ShortStorage storage, ShortEvents events,
                         RateLimiterService rateLimiter, ShortsProperties props) {
        this.repo = repo;
        this.storage = storage;
        this.events = events;
        this.rateLimiter = rateLimiter;
        this.props = props;
    }

    // ---- Feed aur lists ---------------------------------------------------------------------

    /** Feed ka ek page. sort: foryou / latest / popular. size 1-30 ke beech. */
    public ShortDtos.Page feed(String viewer, String sort, String cursor, int size) {
        ShortsRepository.Sort s = parseSort(sort);
        int limit = clamp(size);
        ShortCursor c = ShortCursor.decode(cursor);
        List<ShortDtos.Short> items = repo.feed(viewer, s, c, limit);
        String next = null;
        if (items.size() == limit) {
            ShortDtos.Short last = items.get(items.size() - 1);
            next = (s == ShortsRepository.Sort.LATEST && last.publishedAt() != null)
                    ? ShortCursor.time(last.publishedAt().toInstant(), last.id()).encode()
                    : ShortCursor.offset(c.offset() + items.size()).encode();
        }
        return new ShortDtos.Page(items, next);
    }

    /** Ek short - doosron ko sirf READY, owner ko har status me. Na mile to 404. */
    public ShortDtos.Short get(String id, String viewer) {
        ShortsRepository.Row row = repo.findById(id, viewer).orElseThrow(() -> new ResourceNotFoundException("Short not found"));
        // Doosre log sirf published (READY) short dekh sakte hain; owner apna har status me.
        if (!"READY".equals(row.dto().status()) && !row.dto().mine()) throw new ResourceNotFoundException("Short not found");
        return row.dto();
    }

    /** User ke shorts (offset pagination). */
    public ShortDtos.Page byUser(String userId, String viewer, String cursor, int size) {
        return offsetPage(cursor, size, (off, lim) -> repo.byUser(userId, viewer, off, lim));
    }

    /** Gaane ke shorts. */
    public ShortDtos.Page bySong(String songId, String viewer, String cursor, int size) {
        return offsetPage(cursor, size, (off, lim) -> repo.bySong(songId, viewer, off, lim));
    }

    /** User ke liked shorts. */
    public ShortDtos.Page liked(String userId, String cursor, int size) {
        return offsetPage(cursor, size, (off, lim) -> repo.likedBy(userId, off, lim));
    }

    private interface OffsetQuery {
        List<ShortDtos.Short> run(int offset, int limit);
    }

    /** Offset wali pagination: size+1 maango; zyada aaye to agla page hai (nextCursor banao). */
    private ShortDtos.Page offsetPage(String cursor, int size, OffsetQuery query) {
        ShortCursor c = ShortCursor.decode(cursor);
        int limit = clamp(size);
        List<ShortDtos.Short> items = query.run(c.offset(), limit);
        String next = items.size() == limit ? ShortCursor.offset(c.offset() + limit).encode() : null;
        return new ShortDtos.Page(items, next);
    }

    // ---- Upload ------------------------------------------------------------------------------

    /** Upload shuru (class doc ka step 1). Galat type / bada file = 400, banned = 403, song nahi = 404, 5/din se zyada = 429. */
    @Transactional
    public ShortDtos.UploadResponse startUpload(String userId, ShortDtos.UploadRequest request) {
        String contentType = request.contentType().trim().toLowerCase(Locale.ROOT);
        if (!CONTENT_TYPES.contains(contentType)) throw new BadRequestException("Only MP4 or MOV videos can be uploaded");
        if (request.sizeBytes() > props.maxUploadBytes()) {
            throw new BadRequestException("Videos can be at most " + (props.maxUploadBytes() / 1024 / 1024) + " MB");
        }
        OffsetDateTime banned = repo.bannedUntil(userId).orElse(null);
        if (banned != null && banned.isAfter(OffsetDateTime.now())) {
            throw new ForbiddenException("You can't post shorts right now");
        }
        String songId = blankToNull(request.songId());
        if (songId != null && !repo.songExists(songId)) throw new ResourceNotFoundException("Song not found");
        rateLimiter.checkRateLimit("ratelimit:shorts:upload:" + userId, props.maxUploadsPerDay(), Duration.ofDays(1));

        String id = UUID.randomUUID().toString();
        String rawKey = "shorts-raw/" + id + ("video/quicktime".equals(contentType) ? ".mov" : ".mp4");
        repo.insertUpload(id, userId, rawKey, cleanCaption(request.caption()), songId);
        String url = storage.presignUpload(rawKey, contentType, request.sizeBytes(), props.uploadUrlTtl());
        return new ShortDtos.UploadResponse(id, url, "PUT", contentType, props.uploadUrlTtl().toSeconds());
    }

    /** App ye tab call karta hai jab S3 pe PUT ho gaya. PROCESSING karke "shorts/process" event bhejta hai. */
    public ShortDtos.Short completeUpload(String id, String userId) {
        String rawKey = repo.markProcessing(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("No upload in progress for this short"));
        events.send("shorts/process", Map.of("shortId", id, "rawKey", rawKey), "short-" + id);
        return get(id, userId);
    }

    /** Caption / linked song badlo (sirf owner). */
    public ShortDtos.Short update(String id, String userId, ShortDtos.UpdateRequest request) {
        boolean setCaption = request.caption() != null;
        boolean clearSong = Boolean.TRUE.equals(request.clearSong());
        String songId = clearSong ? null : blankToNull(request.songId());
        boolean setSong = clearSong || songId != null;
        if (songId != null && !repo.songExists(songId)) throw new ResourceNotFoundException("Song not found");
        int updated = repo.updateOwned(id, userId, setCaption ? cleanCaption(request.caption()) : null, setCaption, songId, setSong);
        if (updated == 0) throw new ResourceNotFoundException("Short not found");
        return get(id, userId);
    }

    /** Apna short delete (soft). PROCESSING chal rahi thi to "shorts/cancel", phir files hatane ke liye "shorts/delete" event. */
    public void delete(String id, String userId) {
        String[] prev = repo.markDeleted(id, userId).orElseThrow(() -> new ResourceNotFoundException("Short not found"));
        String previousStatus = prev[0];
        String rawKey = prev[1];
        if ("PROCESSING".equals(previousStatus)) {
            sendQuietly("shorts/cancel", Map.of("shortId", id));
        }
        Map<String, Object> data = new HashMap<>();
        data.put("shortId", id);
        data.put("rawKey", rawKey);
        sendQuietly("shorts/delete", data);
    }

    // ---- Like, report, views ------------------------------------------------------------------

    /** Like karo (sirf READY short). */
    @Transactional
    public ShortDtos.LikeStatus like(String id, String userId) {
        long count = repo.like(id, userId).orElseThrow(() -> new ResourceNotFoundException("Short not found"));
        return new ShortDtos.LikeStatus(id, true, count);
    }

    /** Unlike karo. */
    @Transactional
    public ShortDtos.LikeStatus unlike(String id, String userId) {
        long count = repo.unlike(id, userId).orElseThrow(() -> new ResourceNotFoundException("Short not found"));
        return new ShortDtos.LikeStatus(id, false, count);
    }

    /** Report karo. Wajah allowed list me honi chahiye; apna short report nahi kar sakte (400). */
    @Transactional
    public void report(String id, String userId, ShortDtos.ReportRequest request) {
        String reason = request.reason().trim().toUpperCase(Locale.ROOT);
        if (!REPORT_REASONS.contains(reason)) throw new BadRequestException("Unknown report reason");
        ShortsRepository.Row row = repo.findById(id, userId).orElseThrow(() -> new ResourceNotFoundException("Short not found"));
        if (row.dto().mine()) throw new BadRequestException("You can't report your own short");
        String status = repo.report(id, userId, reason, blankToNull(request.note()), props.autoHideReports())
                .orElseThrow(() -> new ResourceNotFoundException("Short not found"));
        if ("HIDDEN".equals(status)) log.warn("Short {} hidden after reports, pending admin review", id);
    }

    /** Views ka batch: 1 second se kam dekhe wale chhodo, baaki gin lo. */
    public void recordViews(ShortDtos.ViewBatch batch) {
        Map<String, Long> counts = new HashMap<>();
        // View tabhi ginte hain jab kam se kam 1 second dekha ho.
        batch.views().stream().filter(v -> v.watchedMs() >= 1000).forEach(v -> counts.merge(v.shortId(), 1L, Long::sum));
        if (!counts.isEmpty()) repo.addViews(counts);
    }

    // ---- Chhote helpers ------------------------------------------------------------------------

    /** sort string -> enum (khaali = foryou). Galat = 400. */
    static ShortsRepository.Sort parseSort(String sort) {
        if (sort == null || sort.isBlank()) return ShortsRepository.Sort.FOR_YOU;
        return switch (sort.trim().toLowerCase(Locale.ROOT)) {
            case "latest" -> ShortsRepository.Sort.LATEST;
            case "popular" -> ShortsRepository.Sort.POPULAR;
            case "foryou", "for-you", "for_you" -> ShortsRepository.Sort.FOR_YOU;
            default -> throw new BadRequestException("sort must be foryou, latest or popular");
        };
    }

    /** Page size 1 se 30 ke beech. */
    static int clamp(int size) {
        return Math.max(1, Math.min(MAX_PAGE, size));
    }

    /** Caption trim karo aur beech ke extra spaces ek karo. Khaali ho to null; 300 characters se lamba ho to 400. */
    static String cleanCaption(String caption) {
        if (caption == null) return null;
        String text = caption.trim().replaceAll("\\s+", " ");
        if (text.length() > 300) throw new BadRequestException("Caption can be at most 300 characters");
        return text.isEmpty() ? null : text;
    }

    /** Khaali string -> null. */
    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    /** Inngest event bhejo; fail ho to sirf warning (user ka kaam nahi rukta). */
    private void sendQuietly(String name, Map<String, Object> data) {
        try {
            events.send(name, data, null);
        } catch (RuntimeException e) {
            // Listeners ke liye short pehle hi gayab hai; files admin ki taraf se retry me saaf ho jaayengi.
            log.warn("Could not send {} for short {}: {}", name, data.get("shortId"), e.getMessage());
        }
    }
}

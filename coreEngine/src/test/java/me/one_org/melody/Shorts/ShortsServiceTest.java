package me.one_org.melody.Shorts;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import me.one_org.melody.Exceptions.BadRequestException;
import me.one_org.melody.Exceptions.ForbiddenException;
import me.one_org.melody.Exceptions.ResourceNotFoundException;
import me.one_org.melody.Services.Authentication.RateLimiterService;

/**
 * Unit test: ShortsService ko akele check karta hai (dependencies Mockito se nakli (mock) hain, taaki sirf isi class ka logic test ho).
 * Har @Test method ek behaviour check karta hai - method ka naam batata hai kya.
 */
class ShortsServiceTest {

    private ShortsRepository repo;
    private ShortStorage storage;
    private ShortEvents events;
    private RateLimiterService rateLimiter;
    private ShortsService service;

    @BeforeEach
    void setUp() {
        repo = mock(ShortsRepository.class);
        storage = mock(ShortStorage.class);
        events = mock(ShortEvents.class);
        rateLimiter = mock(RateLimiterService.class);
        service = new ShortsService(repo, storage, events, rateLimiter,
                new ShortsProperties(null, null, 0, 0, null, 0, null, null));
        when(repo.bannedUntil(anyString())).thenReturn(Optional.empty());
        when(storage.presignUpload(anyString(), anyString(), anyLong(), any())).thenReturn("https://s3/put");
    }

    private static ShortDtos.Short dto(String id, String status, boolean mine) {
        return new ShortDtos.Short(id, null, status, null, null, null, null, null, 0, 0, false, mine,
                new ShortDtos.Owner("LISTENER", "u1", "me"), null, null, OffsetDateTime.now(), OffsetDateTime.now());
    }

    @Test
    void uploadSignsAPutForAnMp4AndRecordsTheShort() {
        ShortDtos.UploadResponse res = service.startUpload("u1",
                new ShortDtos.UploadRequest("video/mp4", 5_000_000, "  first   short ", null));

        assertThat(res.uploadUrl()).isEqualTo("https://s3/put");
        assertThat(res.method()).isEqualTo("PUT");
        ArgumentCaptor<String> key = ArgumentCaptor.forClass(String.class);
        verify(repo).insertUpload(eq(res.shortId()), eq("u1"), key.capture(), eq("first short"), isNull());
        assertThat(key.getValue()).isEqualTo("shorts-raw/" + res.shortId() + ".mp4");
        verify(rateLimiter).checkRateLimit("ratelimit:shorts:upload:u1", 5, Duration.ofDays(1));
    }

    @Test
    void uploadRejectsOtherTypesOversizedFilesAndBannedUsers() {
        assertThatThrownBy(() -> service.startUpload("u1", new ShortDtos.UploadRequest("image/png", 10, null, null)))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.startUpload("u1", new ShortDtos.UploadRequest("video/mp4", 200L * 1024 * 1024, null, null)))
                .isInstanceOf(BadRequestException.class);

        when(repo.bannedUntil("u2")).thenReturn(Optional.of(OffsetDateTime.now().plusDays(1)));
        assertThatThrownBy(() -> service.startUpload("u2", new ShortDtos.UploadRequest("video/mp4", 10, null, null)))
                .isInstanceOf(ForbiddenException.class);
        verify(repo, never()).insertUpload(anyString(), anyString(), anyString(), any(), any());
    }

    @Test
    void anExpiredBanNoLongerBlocks() {
        when(repo.bannedUntil("u1")).thenReturn(Optional.of(OffsetDateTime.now().minusMinutes(1)));
        service.startUpload("u1", new ShortDtos.UploadRequest("video/quicktime", 10, null, null));
        verify(repo).insertUpload(anyString(), eq("u1"), org.mockito.ArgumentMatchers.endsWith(".mov"), isNull(), isNull());
    }

    @Test
    void uploadLinkedToAMissingSongIs404() {
        when(repo.songExists("nope")).thenReturn(false);
        assertThatThrownBy(() -> service.startUpload("u1", new ShortDtos.UploadRequest("video/mp4", 10, null, "nope")))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void completingSendsTheProcessEvent() {
        when(repo.markProcessing("s1", "u1")).thenReturn(Optional.of("shorts-raw/s1.mp4"));
        when(repo.findById("s1", "u1")).thenReturn(Optional.of(new ShortsRepository.Row(dto("s1", "PROCESSING", true), "u1", "k")));

        ShortDtos.Short s = service.completeUpload("s1", "u1");

        assertThat(s.status()).isEqualTo("PROCESSING");
        verify(events).send("shorts/process", Map.of("shortId", "s1", "rawKey", "shorts-raw/s1.mp4"), "short-s1");
    }

    @Test
    void completingSomeoneElsesUploadIs404() {
        when(repo.markProcessing("s1", "intruder")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.completeUpload("s1", "intruder")).isInstanceOf(ResourceNotFoundException.class);
        verify(events, never()).send(anyString(), anyMap(), any());
    }

    @Test
    void deletingWhileProcessingCancelsThenDeletes() {
        when(repo.markDeleted("s1", "u1")).thenReturn(Optional.of(new String[] {"PROCESSING", "shorts-raw/s1.mp4"}));
        service.delete("s1", "u1");
        ArgumentCaptor<String> names = ArgumentCaptor.forClass(String.class);
        verify(events, org.mockito.Mockito.times(2)).send(names.capture(), anyMap(), isNull());
        assertThat(names.getAllValues()).containsExactly("shorts/cancel", "shorts/delete");
    }

    @Test
    void othersCantSeeUnpublishedShorts() {
        when(repo.findById("s1", "u2")).thenReturn(Optional.of(new ShortsRepository.Row(dto("s1", "PROCESSING", false), "u1", "k")));
        assertThatThrownBy(() -> service.get("s1", "u2")).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void youCantReportYourOwnShortOrUseAnUnknownReason() {
        when(repo.findById("s1", "u1")).thenReturn(Optional.of(new ShortsRepository.Row(dto("s1", "READY", true), "u1", "k")));
        assertThatThrownBy(() -> service.report("s1", "u1", new ShortDtos.ReportRequest("SPAM", null)))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.report("s1", "u2", new ShortDtos.ReportRequest("BORING", null)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void reportsUseTheAutoHideThreshold() {
        when(repo.findById("s1", "u2")).thenReturn(Optional.of(new ShortsRepository.Row(dto("s1", "READY", false), "u1", "k")));
        when(repo.report("s1", "u2", "SPAM", "ads", 3)).thenReturn(Optional.of("HIDDEN"));
        service.report("s1", "u2", new ShortDtos.ReportRequest("spam", "ads"));
        verify(repo).report("s1", "u2", "SPAM", "ads", 3);
    }

    @Test
    void viewsUnderASecondDontCount() {
        service.recordViews(new ShortDtos.ViewBatch(List.of(
                new ShortDtos.ViewBatch.View("a", 4000),
                new ShortDtos.ViewBatch.View("a", 1200),
                new ShortDtos.ViewBatch.View("b", 300))));
        verify(repo).addViews(Map.of("a", 2L));
    }

    @Test
    void latestFeedReturnsATimeCursorWhenThePageIsFull() {
        ShortDtos.Short last = dto("s9", "READY", false);
        when(repo.feed(eq("u1"), eq(ShortsRepository.Sort.LATEST), any(), eq(2))).thenReturn(List.of(dto("s8", "READY", false), last));

        ShortDtos.Page page = service.feed("u1", "latest", null, 2);

        ShortCursor next = ShortCursor.decode(page.nextCursor());
        assertThat(next.isTimeCursor()).isTrue();
        assertThat(next.id()).isEqualTo("s9");
    }

    @Test
    void sortsAndCursorsAreValidated() {
        assertThat(ShortsService.parseSort(null)).isEqualTo(ShortsRepository.Sort.FOR_YOU);
        assertThat(ShortsService.parseSort("Popular")).isEqualTo(ShortsRepository.Sort.POPULAR);
        assertThatThrownBy(() -> ShortsService.parseSort("weird")).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> ShortCursor.decode("!!not-base64")).isInstanceOf(BadRequestException.class);

        ShortCursor t = ShortCursor.time(Instant.ofEpochMilli(1_700_000_000_000L), "abc");
        assertThat(ShortCursor.decode(t.encode())).isEqualTo(t);
        assertThat(ShortCursor.decode(ShortCursor.offset(40).encode()).offset()).isEqualTo(40);
        assertThat(ShortsService.clamp(500)).isEqualTo(30);
    }
}

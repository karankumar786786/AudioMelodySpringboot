package me.oneorg.melody.events;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

class OutboxPayloadsTest {

    private final EventMeta meta = EventIds.meta(EventIds.newId(), Instant.parse("2026-11-20T10:00:00Z"),
            Instant.parse("2026-11-20T10:00:01Z"), "admin-api");

    @Test
    void convertsSongChangedFromAdminJson() {
        SongChanged song = (SongChanged) OutboxPayloads.toAvro(Topics.CATALOG_SONG, Map.of(
                "song_id", "s1", "change", "published", "title", "Song", "artist_ids", List.of("a1", "a2"),
                "status", "ACTIVE"), meta);
        assertEquals(SongChangeType.PUBLISHED, song.getChange());
        assertEquals(List.of("a1", "a2"), song.getArtistIds());
        assertNull(song.getArtistName());
        assertEquals(meta.getEventId(), song.getMeta().getEventId());
        assertEquals(meta.getOccurredAt(), song.getMeta().getOccurredAt());
    }

    @Test
    void fillsDefaultsForMissingOptionalFields() {
        EmailRequested email = (EmailRequested) OutboxPayloads.toAvro(Topics.EMAIL, Map.of(
                "to", "a@b.com", "kind", "LOGIN", "subject", "LOGIN", "body", "123456"), meta);
        assertEquals(0, email.getAttempt());
        assertNull(email.getNotBefore());
    }

    @Test
    void rejectsMissingRequiredFieldsAndUnknownEnumValues() {
        assertThrows(IllegalArgumentException.class,
                () -> OutboxPayloads.toAvro(Topics.FAVOURITE, Map.of("user_id", "u"), meta));
        assertThrows(IllegalArgumentException.class,
                () -> OutboxPayloads.toAvro(Topics.USER_LIFECYCLE, Map.of("user_id", "u", "type", "VANISHED"), meta));
    }

    @Test
    void knowsWhichTopicsComeFromTheOutbox() {
        assertTrue(OutboxPayloads.supports(Topics.ARTIST_FOLLOW));
        assertEquals(false, OutboxPayloads.supports(Topics.PLAY));
    }
}

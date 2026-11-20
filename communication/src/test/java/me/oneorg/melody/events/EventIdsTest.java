package me.oneorg.melody.events;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class EventIdsTest {

    @Test
    void generatesVersion7Ids() {
        UUID id = UUID.fromString(EventIds.newId());
        assertEquals(7, id.version());
        assertEquals(2, id.variant());
    }

    @Test
    void idsSortByTime() {
        String earlier = EventIds.newId(1_700_000_000_000L);
        String later = EventIds.newId(1_700_000_000_001L);
        assertTrue(earlier.compareTo(later) < 0);
    }

    @Test
    void validatesUuidStrings() {
        assertTrue(EventIds.isValid(UUID.randomUUID().toString()));
        assertFalse(EventIds.isValid("not-a-uuid"));
        assertFalse(EventIds.isValid(null));
    }

    @Test
    void buildsGeneratedAvroRecords() {
        PlayEvent event = PlayEvent.newBuilder()
                .setMeta(EventIds.serverMeta("test"))
                .setUserId("u1")
                .setSongId("s1")
                .setListenedRatio(0.5)
                .build();
        assertEquals("u1", event.getUserId());
        assertTrue(event.getMeta().getOccurredAt().isBefore(Instant.now().plusSeconds(1)));
    }
}

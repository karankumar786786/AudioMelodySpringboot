package me.one_org.melody.Events.Kafka;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.apache.avro.specific.SpecificRecord;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import me.one_org.melody.Dto.Controllers.Api.InteractionBatchRequestDto.Event;
import me.one_org.melody.Exceptions.BadRequestException;
import me.oneorg.melody.events.PlayEvent;
import me.oneorg.melody.events.SearchInteraction;
import me.oneorg.melody.events.Topics;

class TelemetryProducerTest {

    private EventPublisher publisher;
    private TelemetryProducer producer;

    @BeforeEach
    void setUp() {
        publisher = mock(EventPublisher.class);
        EventsProperties props = new EventsProperties(EventsMode.KAFKA, "core-api", null, 0, 50, null, 0, null);
        producer = new TelemetryProducer(publisher, props);
    }

    private static Event play(String id, Long at, Double pct) {
        return new Event("play", id, at, "song-1", pct, 200_000L, null, null);
    }

    @Test
    void playIsKeyedByTheTokenUserAndKeepsTheClientIdAndClock() {
        String id = UUID.randomUUID().toString();
        long at = Instant.now().minusSeconds(60).toEpochMilli();

        producer.batch("user-from-token", List.of(play(id, at, 0.8)));

        ArgumentCaptor<SpecificRecord> value = ArgumentCaptor.forClass(SpecificRecord.class);
        verify(publisher).publish(eq(Topics.PLAY), eq("user-from-token"), value.capture(), eq(Instant.ofEpochMilli(at)));
        PlayEvent event = (PlayEvent) value.getValue();
        assertThat(event.getUserId()).isEqualTo("user-from-token");
        assertThat(event.getMeta().getEventId()).isEqualTo(id);
        assertThat(event.getListenedRatio()).isEqualTo(0.8);
        assertThat(event.getDurationMs()).isEqualTo(200_000L);
    }

    @Test
    void oneBadEventRejectsTheWholeBatchBeforeAnythingIsSent() {
        List<Event> events = List.of(play(null, null, 0.5), new Event("teleport", null, null, "s", null, null, null, null));

        assertThatThrownBy(() -> producer.batch("u", events)).isInstanceOf(BadRequestException.class);
        verify(publisher, never()).publish(any(), any(), any(), any());
    }

    @Test
    void rejectsTimestampsFarFromTheServerClock() {
        long tooOld = Instant.now().minusSeconds(3 * 24 * 3600).toEpochMilli();
        assertThatThrownBy(() -> producer.batch("u", List.of(play(null, tooOld, 0.5))))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void rejectsNonUuidEventIdsAndOutOfRangeRatios() {
        assertThatThrownBy(() -> producer.batch("u", List.of(play("abc", null, 0.5))))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> producer.batch("u", List.of(play(null, null, 1.5))))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void rejectsBatchesOverTheLimit() {
        List<Event> events = java.util.stream.IntStream.range(0, 51).mapToObj(i -> play(null, null, 0.5)).toList();
        assertThatThrownBy(() -> producer.batch("u", events)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void anonymousSearchIsKeyedAsAnonymous() {
        producer.search(null, me.oneorg.melody.events.SearchAction.CLICK, "ARTIST", "artist-1");

        ArgumentCaptor<SpecificRecord> value = ArgumentCaptor.forClass(SpecificRecord.class);
        verify(publisher, times(1)).publish(eq(Topics.SEARCH_INTERACTION), eq(TelemetryProducer.ANONYMOUS), value.capture(), any());
        assertThat(((SearchInteraction) value.getValue()).getUserId()).isNull();
    }
}

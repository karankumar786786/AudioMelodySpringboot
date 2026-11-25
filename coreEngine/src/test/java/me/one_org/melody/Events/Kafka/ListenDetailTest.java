package me.one_org.melody.Events.Kafka;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.util.List;

import org.apache.avro.specific.SpecificRecord;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import me.one_org.melody.Dto.Controllers.Api.InteractionBatchRequestDto.Event;
import me.one_org.melody.Exceptions.BadRequestException;
import me.oneorg.melody.events.ListenRange;
import me.oneorg.melody.events.PlayEvent;
import me.oneorg.melody.events.SkipEvent;
import me.oneorg.melody.events.Topics;

class ListenDetailTest {

    private static List<Long> p(long a, long b) {
        return List.of(a, b);
    }

    @Test
    void rangesAreClampedSortedAndMerged() {
        ListenDetail d = ListenDetail.of(
                List.of(p(30_000, 60_000), p(0, 10_000), p(5_000, 20_000), p(55_000, 250_000), p(70_000, 70_000)),
                null, null, null, null, null, null, null, null, 200_000L);
        assertThat(d.ranges()).extracting(ListenRange::getStartMs, ListenRange::getEndMs)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple(0L, 20_000L),
                        org.assertj.core.groups.Tuple.tuple(30_000L, 200_000L));
    }

    @Test
    void qualityAndPlatformAreNormalisedAndChecked() {
        ListenDetail d = ListenDetail.of(null, 5000L, true, List.of(p(1000, 90_000)), "320KBPS", "iOS", 450L, 2, 1800L, null);
        assertThat(d.quality()).isEqualTo("320kbps");
        assertThat(d.platform()).isEqualTo("ios");
        assertThat(d.skipped()).isTrue();
        assertThat(d.seeks()).hasSize(1);
        assertThat(d.rebufferCount()).isEqualTo(2);
        assertThatThrownBy(() -> ListenDetail.of(null, null, null, null, "8k", null, null, null, null, null))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> ListenDetail.of(null, null, null, null, null, "fridge", null, null, null, null))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void badShapesAreRejected() {
        assertThatThrownBy(() -> ListenDetail.of(List.of(List.of(1L)), null, null, null, null, null, null, null, null, null))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> ListenDetail.of(List.of(p(-5, 10)), null, null, null, null, null, null, null, null, null))
                .isInstanceOf(BadRequestException.class);
        List<List<Long>> tooMany = java.util.stream.IntStream.range(0, 201).mapToObj(i -> p(i, i + 1L)).toList();
        assertThatThrownBy(() -> ListenDetail.of(tooMany, null, null, null, null, null, null, null, null, null))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void batchPlaysAndSkipsCarryTheDetailOntoTheAvroEvents() {
        EventPublisher publisher = mock(EventPublisher.class);
        TelemetryProducer producer = new TelemetryProducer(publisher,
                new EventsProperties(EventsMode.KAFKA, "core-api", null, 0, 50, null, 0, null));
        Event play = new Event("play", null, null, "s1", 0.5, 180_000L, null, null,
                List.of(p(0, 30_000), p(60_000, 90_000)), 90_000L, true, List.of(p(30_000, 60_000)),
                "auto", "android", 320L, 1, 700L, null);
        Event skip = new Event("skip", null, null, "s1", null, null, null, null,
                null, null, null, null, null, null, null, null, null, 42_000L);

        producer.batch("u1", List.of(play, skip));

        ArgumentCaptor<SpecificRecord> value = ArgumentCaptor.forClass(SpecificRecord.class);
        verify(publisher).publish(eq(Topics.PLAY), eq("u1"), value.capture(), any());
        PlayEvent e = (PlayEvent) value.getValue();
        assertThat(e.getRanges()).hasSize(2);
        assertThat(e.getExitMs()).isEqualTo(90_000L);
        assertThat(e.getSkipped()).isTrue();
        assertThat(e.getQuality()).isEqualTo("auto");
        assertThat(e.getStartupMs()).isEqualTo(320L);

        ArgumentCaptor<SpecificRecord> skipValue = ArgumentCaptor.forClass(SpecificRecord.class);
        verify(publisher).publish(eq(Topics.SKIP), eq("u1"), skipValue.capture(), any());
        assertThat(((SkipEvent) skipValue.getValue()).getPositionMs()).isEqualTo(42_000L);
    }
}

package me.oneorg.melody.streams.config;

import java.time.Duration;
import java.util.function.Function;

import org.apache.kafka.common.serialization.Serdes;
import org.apache.kafka.streams.KeyValue;
import org.apache.kafka.streams.StreamsBuilder;
import org.apache.kafka.streams.processor.PunctuationType;
import org.apache.kafka.streams.processor.api.FixedKeyProcessor;
import org.apache.kafka.streams.processor.api.FixedKeyProcessorContext;
import org.apache.kafka.streams.processor.api.FixedKeyProcessorSupplier;
import org.apache.kafka.streams.processor.api.FixedKeyRecord;
import org.apache.kafka.streams.state.KeyValueIterator;
import org.apache.kafka.streams.state.KeyValueStore;
import org.apache.kafka.streams.state.StoreBuilder;
import org.apache.kafka.streams.state.Stores;

/**
 * Drops records whose event_id was already seen in the last 24 hours. Producers retry
 * and the outbox relay is at-least-once, so the same event can arrive more than once.
 * Must run before any repartition: the source key (user id) keeps duplicates on the
 * same partition, so one store sees them all.
 */
public final class Dedupe {

    public static final Duration WINDOW = Duration.ofHours(24);

    private Dedupe() {}

    public static void addStore(StreamsBuilder builder, String storeName) {
        StoreBuilder<KeyValueStore<String, Long>> store = Stores.keyValueStoreBuilder(
                Stores.persistentKeyValueStore(storeName), Serdes.String(), Serdes.Long());
        builder.addStateStore(store);
    }

    public static <V> FixedKeyProcessorSupplier<String, V, V> byEventId(String storeName, Function<V, String> eventId) {
        return () -> new FixedKeyProcessor<>() {
            private KeyValueStore<String, Long> seen;
            private FixedKeyProcessorContext<String, V> context;

            @Override
            public void init(FixedKeyProcessorContext<String, V> context) {
                this.context = context;
                this.seen = context.getStateStore(storeName);
                context.schedule(Duration.ofMinutes(30), PunctuationType.WALL_CLOCK_TIME, now -> {
                    long cutoff = now - WINDOW.toMillis();
                    try (KeyValueIterator<String, Long> it = seen.all()) {
                        while (it.hasNext()) {
                            KeyValue<String, Long> entry = it.next();
                            if (entry.value < cutoff) seen.delete(entry.key);
                        }
                    }
                });
            }

            @Override
            public void process(FixedKeyRecord<String, V> record) {
                if (record.value() == null) return;
                String id = eventId.apply(record.value());
                if (id == null || seen.get(id) != null) return;
                seen.put(id, System.currentTimeMillis());
                context.forward(record);
            }
        };
    }
}

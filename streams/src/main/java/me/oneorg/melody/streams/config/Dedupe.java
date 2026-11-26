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
 * Duplicate events hatata hai (DEDUPE): pichle 24 ghante me jo event_id aa chuka, wo dobara aaye to drop.
 * Producers retry karte hain aur outbox relay "at-least-once" hai (kam se kam ek baar, kabhi do baar),
 * isliye same event do baar aa sakta hai.
 * Isse kisi bhi repartition (key badalne) se PEHLE chalana zaroori hai: tab tak key = user id hai, to
 * ek event ke saare duplicates ek hi partition pe aate hain aur ek hi state store sabko dekh leta hai.
 */
public final class Dedupe {

    public static final Duration WINDOW = Duration.ofHours(24);

    private Dedupe() {}

    /** Event ids yaad rakhne wala state store (RocksDB) topology me jodo. */
    public static void addStore(StreamsBuilder builder, String storeName) {
        StoreBuilder<KeyValueStore<String, Long>> store = Stores.keyValueStoreBuilder(
                Stores.persistentKeyValueStore(storeName), Serdes.String(), Serdes.Long());
        builder.addStateStore(store);
    }

    /**
     * Processor jo duplicate event_id wale records drop karta hai.
     * Har 30 minute (wall clock) 24 ghante se purani ids store se saaf karta hai.
     */
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

            /** Id pehle dekhi hai to drop; nahi to yaad rakho aur aage bhejo. */
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

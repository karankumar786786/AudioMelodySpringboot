package me.oneorg.melody.streams;

import java.util.Map;

import org.apache.avro.specific.SpecificRecord;

import io.confluent.kafka.streams.serdes.avro.SpecificAvroSerde;

/**
 * Tests ke liye Avro serdes banane ka helper (nakli / in-memory Schema Registry ke saath).
 */
public final class TestSerdes {
    private TestSerdes() {}

    public static <T extends SpecificRecord> SpecificAvroSerde<T> serde(String scope) {
        SpecificAvroSerde<T> serde = new SpecificAvroSerde<>();
        serde.configure(Map.of("schema.registry.url", "mock://" + scope), false);
        return serde;
    }
}

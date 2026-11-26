package me.oneorg.melody.streams.config;

import java.util.HashMap;
import java.util.Map;
import java.util.function.Consumer;

import org.apache.avro.specific.SpecificRecord;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.common.serialization.Serdes;
import org.apache.kafka.streams.StreamsBuilder;
import org.apache.kafka.streams.StreamsConfig;
import org.springframework.boot.kafka.autoconfigure.KafkaProperties;
import org.springframework.kafka.config.KafkaStreamsConfiguration;
import org.springframework.kafka.config.StreamsBuilderFactoryBean;
import org.springframework.kafka.streams.RecoveringDeserializationExceptionHandler;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.stereotype.Component;

import io.confluent.kafka.streams.serdes.avro.SpecificAvroSerde;

/**
 * Har topology ke liye ek alag KafkaStreams instance banata hai - apni application.id, apni state directory
 * aur exactly-once processing ke saath (exactly-once = har event ka asar ek hi baar, crash ke baad bhi).
 * Jo records padhe nahi ja sakte wo DLQ (dead letter queue) me jaate hain.
 */
@Component
public class StreamsTopologyFactory {

    private final KafkaProperties kafkaProperties;
    private final PipelineProperties pipeline;
    private final DeadLetterPublishingRecoverer recoverer;

    public StreamsTopologyFactory(KafkaProperties kafkaProperties, PipelineProperties pipeline,
                                  DeadLetterPublishingRecoverer deadLetterRecoverer) {
        this.kafkaProperties = kafkaProperties;
        this.pipeline = pipeline;
        this.recoverer = deadLetterRecoverer;
    }

    /** Ek Kafka Streams app ki settings: exactly-once, state dir, 5 sec commit + 10 MB cache, DLQ handler. */
    public Map<String, Object> streamsProps(String applicationId) {
        Map<String, Object> props = new HashMap<>(kafkaProperties.buildStreamsProperties());
        props.put(StreamsConfig.APPLICATION_ID_CONFIG, applicationId);
        props.put(StreamsConfig.BOOTSTRAP_SERVERS_CONFIG, String.join(",", kafkaProperties.getBootstrapServers()));
        props.put(StreamsConfig.PROCESSING_GUARANTEE_CONFIG, StreamsConfig.EXACTLY_ONCE_V2);
        props.put(StreamsConfig.REPLICATION_FACTOR_CONFIG, pipeline.replicationFactor());
        props.put(StreamsConfig.STATE_DIR_CONFIG, pipeline.stateDir());
        // Same key ke updates ko jodo (cache): kam stats records, kam DB writes.
        props.put(StreamsConfig.COMMIT_INTERVAL_MS_CONFIG, 5000);
        props.put(StreamsConfig.STATESTORE_CACHE_MAX_BYTES_CONFIG, 10 * 1024 * 1024L);
        props.put(StreamsConfig.DEFAULT_KEY_SERDE_CLASS_CONFIG, Serdes.StringSerde.class);
        props.put(StreamsConfig.consumerPrefix(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG), "earliest");
        props.put(StreamsConfig.DESERIALIZATION_EXCEPTION_HANDLER_CLASS_CONFIG, RecoveringDeserializationExceptionHandler.class);
        props.put(RecoveringDeserializationExceptionHandler.KSTREAM_DESERIALIZATION_RECOVERER, recoverer);
        props.put("schema.registry.url", pipeline.schemaRegistryUrl());
        return props;
    }

    /** Spring ka KafkaStreams bean banao jo di hui topology chalaye. */
    public StreamsBuilderFactoryBean create(String applicationId, Consumer<StreamsBuilder> topology) throws Exception {
        StreamsBuilderFactoryBean factory = new StreamsBuilderFactoryBean(new KafkaStreamsConfiguration(streamsProps(applicationId)));
        factory.setInfrastructureCustomizer(new org.springframework.kafka.config.KafkaStreamsInfrastructureCustomizer() {
            @Override
            public void configureBuilder(StreamsBuilder builder) {
                topology.accept(builder);
            }
        });
        return factory;
    }

    /** Avro serde (Java object <-> bytes) jo Schema Registry use karta hai. */
    public <T extends SpecificRecord> SpecificAvroSerde<T> serde() {
        SpecificAvroSerde<T> serde = new SpecificAvroSerde<>();
        serde.configure(Map.of("schema.registry.url", pipeline.schemaRegistryUrl()), false);
        return serde;
    }

}

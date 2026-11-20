package me.oneorg.melody.streams.config;

import java.util.HashMap;
import java.util.Map;

import org.apache.avro.specific.SpecificRecord;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.serialization.ByteArraySerializer;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.boot.kafka.autoconfigure.KafkaProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.kafka.support.serializer.ErrorHandlingDeserializer;
import org.springframework.util.backoff.FixedBackOff;

import io.confluent.kafka.serializers.KafkaAvroDeserializer;
import io.confluent.kafka.serializers.KafkaAvroDeserializerConfig;
import io.confluent.kafka.serializers.KafkaAvroSerializer;
import me.oneorg.melody.events.Topics;

/**
 * Producers and listener factories shared by every profile. Records that can't be read
 * or keep failing go to pipeline.dlq.v1 with the original bytes and error headers.
 */
@Configuration
public class KafkaPipelineConfig {

    private final KafkaProperties kafkaProperties;
    private final PipelineProperties pipeline;

    public KafkaPipelineConfig(KafkaProperties kafkaProperties, PipelineProperties pipeline) {
        this.kafkaProperties = kafkaProperties;
        this.pipeline = pipeline;
    }

    private Map<String, Object> producerProps() {
        Map<String, Object> props = new HashMap<>(kafkaProperties.buildProducerProperties());
        props.put(ProducerConfig.ACKS_CONFIG, "all");
        props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);
        props.put("schema.registry.url", pipeline.schemaRegistryUrl());
        return props;
    }

    @Bean
    public KafkaTemplate<String, SpecificRecord> avroTemplate() {
        Map<String, Object> props = producerProps();
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, KafkaAvroSerializer.class);
        return new KafkaTemplate<>(new DefaultKafkaProducerFactory<>(props));
    }

    @Bean
    public KafkaTemplate<byte[], byte[]> dlqTemplate() {
        Map<String, Object> props = producerProps();
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, ByteArraySerializer.class);
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, ByteArraySerializer.class);
        return new KafkaTemplate<>(new DefaultKafkaProducerFactory<>(props));
    }

    @Bean
    public DeadLetterPublishingRecoverer deadLetterRecoverer(KafkaTemplate<byte[], byte[]> dlqTemplate) {
        return new DeadLetterPublishingRecoverer(dlqTemplate, (record, ex) -> new TopicPartition(Topics.DLQ, -1));
    }

    private Map<String, Object> consumerProps(String groupId, boolean avro) {
        Map<String, Object> props = new HashMap<>(kafkaProperties.buildConsumerProperties());
        props.put(ConsumerConfig.GROUP_ID_CONFIG, groupId);
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false);
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, ErrorHandlingDeserializer.class);
        props.put(ErrorHandlingDeserializer.VALUE_DESERIALIZER_CLASS,
                avro ? KafkaAvroDeserializer.class : StringDeserializer.class);
        props.put("schema.registry.url", pipeline.schemaRegistryUrl());
        props.put(KafkaAvroDeserializerConfig.SPECIFIC_AVRO_READER_CONFIG, true);
        return props;
    }

    /**
     * Batch listener factory: each poll waits up to {@code fetchWaitMs} for data, which
     * gives the sinks natural batches of a few seconds instead of one write per event.
     */
    public ConcurrentKafkaListenerContainerFactory<String, Object> batchFactory(
            String groupId, boolean avro, int fetchWaitMs, DeadLetterPublishingRecoverer recoverer) {
        Map<String, Object> props = consumerProps(groupId, avro);
        props.put(ConsumerConfig.MAX_POLL_RECORDS_CONFIG, 500);
        props.put(ConsumerConfig.FETCH_MIN_BYTES_CONFIG, 64 * 1024);
        props.put(ConsumerConfig.FETCH_MAX_WAIT_MS_CONFIG, fetchWaitMs);
        ConcurrentKafkaListenerContainerFactory<String, Object> factory = new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(new DefaultKafkaConsumerFactory<>(props));
        factory.setBatchListener(true);
        factory.setCommonErrorHandler(new DefaultErrorHandler(recoverer, new FixedBackOff(2000L, 3)));
        return factory;
    }

    /** Record-at-a-time factory (emails: each send is its own unit of work). */
    public ConcurrentKafkaListenerContainerFactory<String, Object> recordFactory(
            String groupId, boolean avro, DeadLetterPublishingRecoverer recoverer) {
        ConcurrentKafkaListenerContainerFactory<String, Object> factory = new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(new DefaultKafkaConsumerFactory<>(consumerProps(groupId, avro)));
        factory.setCommonErrorHandler(new DefaultErrorHandler(recoverer, new FixedBackOff(2000L, 2)));
        return factory;
    }
}

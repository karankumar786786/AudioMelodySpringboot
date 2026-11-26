package me.one_org.melody.Events.Kafka;

import java.util.Map;

import org.apache.avro.specific.SpecificRecord;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.kafka.autoconfigure.KafkaProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;

import io.confluent.kafka.serializers.KafkaAvroSerializer;

/**
 * Kafka producers (bhejne wale) ki setting.
 * Pehla message bhejne tak Kafka se connect hi nahi hota, isliye LEGACY mode me
 * Kafka na ho tab bhi app aaram se start ho jaata hai.
 */
@Configuration
@EnableConfigurationProperties(EventsProperties.class)
public class KafkaEventsConfig {

    /** Event topics ke liye: key = String, value = Avro (schema Schema Registry se). */
    @Bean
    public ProducerFactory<String, SpecificRecord> avroProducerFactory(KafkaProperties kafkaProperties) {
        Map<String, Object> props = kafkaProperties.buildProducerProperties();
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, KafkaAvroSerializer.class);
        return new DefaultKafkaProducerFactory<>(props);
    }

    /** Avro events bhejne ka template (EventPublisher isko use karta hai). */
    @Bean
    public KafkaTemplate<String, SpecificRecord> avroKafkaTemplate(ProducerFactory<String, SpecificRecord> avroProducerFactory) {
        return new KafkaTemplate<>(avroProducerFactory);
    }

    /** Simple string messages - outbox wake-up signal ke liye. */
    @Bean
    public KafkaTemplate<String, String> stringKafkaTemplate(KafkaProperties kafkaProperties) {
        Map<String, Object> props = kafkaProperties.buildProducerProperties();
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        return new KafkaTemplate<>(new DefaultKafkaProducerFactory<>(props));
    }
}

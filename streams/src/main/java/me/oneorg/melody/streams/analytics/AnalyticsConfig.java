package me.oneorg.melody.streams.analytics;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.config.StreamsBuilderFactoryBean;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;

import me.oneorg.melody.streams.config.KafkaPipelineConfig;
import me.oneorg.melody.streams.config.StreamsTopologyFactory;

@Configuration
@Profile("analytics")
/**
 * analytics profile ki setting: analytics topology aur sink listener.
 */
public class AnalyticsConfig {

    /** Analytics wali Kafka Streams topology. */
    @Bean
    public StreamsBuilderFactoryBean analyticsStreams(StreamsTopologyFactory factory) throws Exception {
        AnalyticsTopology.AnalyticsSerdes serdes = new AnalyticsTopology.AnalyticsSerdes(
                factory.serde(), factory.serde(), factory.serde(), factory.serde(), factory.serde());
        return factory.create("melody-analytics", builder -> AnalyticsTopology.build(builder, serdes));
    }

    /** Sinks 10 second tak data ka wait karte hain, to har write me updates ka ek batch jaata hai. */
    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, Object> analyticsSinkFactory(
            KafkaPipelineConfig config, DeadLetterPublishingRecoverer recoverer) {
        return config.batchFactory("melody-analytics-sink", true, 10_000, recoverer);
    }
}

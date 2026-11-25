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
public class AnalyticsConfig {

    @Bean
    public StreamsBuilderFactoryBean analyticsStreams(StreamsTopologyFactory factory) throws Exception {
        AnalyticsTopology.Serdes5 serdes = new AnalyticsTopology.Serdes5(
                factory.serde(), factory.serde(), factory.serde(), factory.serde(), factory.serde());
        return factory.create("melody-analytics", builder -> AnalyticsTopology.build(builder, serdes));
    }

    /** Sinks poll up to 10 s for data, so each write covers a batch of updates. */
    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, Object> analyticsSinkFactory(
            KafkaPipelineConfig config, DeadLetterPublishingRecoverer recoverer) {
        return config.batchFactory("melody-analytics-sink", true, 10_000, recoverer);
    }
}

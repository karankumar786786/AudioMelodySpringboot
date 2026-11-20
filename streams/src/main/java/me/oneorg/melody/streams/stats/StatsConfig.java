package me.oneorg.melody.streams.stats;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.config.StreamsBuilderFactoryBean;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;

import me.oneorg.melody.streams.config.KafkaPipelineConfig;
import me.oneorg.melody.streams.config.StreamsTopologyFactory;

@Configuration
@Profile("stats")
public class StatsConfig {

    @Bean
    public StreamsBuilderFactoryBean statsStreams(StreamsTopologyFactory factory) throws Exception {
        StatsTopology.Serdes4 serdes = new StatsTopology.Serdes4(factory.serde(), factory.serde(), factory.serde(),
                factory.serde(), factory.serde(), factory.serde(), factory.serde(), factory.serde());
        return factory.create("melody-stats", builder -> StatsTopology.build(builder, serdes));
    }

    /** The Postgres sink polls every few seconds and writes the latest totals per key. */
    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, Object> statsSinkFactory(
            KafkaPipelineConfig config, DeadLetterPublishingRecoverer recoverer) {
        return config.batchFactory("melody-stats-sink", true, 5000, recoverer);
    }
}

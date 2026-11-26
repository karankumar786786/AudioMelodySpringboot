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
/**
 * stats profile ki setting: stats topology aur sink listener.
 */
public class StatsConfig {

    /** Stats wali Kafka Streams topology. */
    @Bean
    public StreamsBuilderFactoryBean statsStreams(StreamsTopologyFactory factory) throws Exception {
        StatsTopology.Serdes4 serdes = new StatsTopology.Serdes4(factory.serde(), factory.serde(), factory.serde(),
                factory.serde(), factory.serde(), factory.serde(), factory.serde(), factory.serde());
        return factory.create("melody-stats", builder -> StatsTopology.build(builder, serdes));
    }

    /** Postgres sink har kuch second me poll karta hai aur har key ka sabse naya total likhta hai. */
    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, Object> statsSinkFactory(
            KafkaPipelineConfig config, DeadLetterPublishingRecoverer recoverer) {
        return config.batchFactory("melody-stats-sink", true, 5000, recoverer);
    }
}

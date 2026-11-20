package me.oneorg.melody.streams.activity;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.config.StreamsBuilderFactoryBean;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;

import me.oneorg.melody.streams.config.KafkaPipelineConfig;
import me.oneorg.melody.streams.config.PipelineProperties;
import me.oneorg.melody.streams.config.StreamsTopologyFactory;

@Configuration
@Profile("activity")
public class ActivityConfig {

    @Bean
    public StreamsBuilderFactoryBean activityStreams(StreamsTopologyFactory factory, PipelineProperties props) throws Exception {
        ActivityTopology.Serdes3 serdes = new ActivityTopology.Serdes3(factory.serde(), factory.serde(), factory.serde());
        return factory.create("melody-activity", builder -> ActivityTopology.build(builder, serdes, props.sessionGap()));
    }

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, Object> sessionSinkFactory(
            KafkaPipelineConfig config, DeadLetterPublishingRecoverer recoverer) {
        return config.batchFactory("melody-session-sink", true, 5000, recoverer);
    }

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, Object> historySinkFactory(
            KafkaPipelineConfig config, DeadLetterPublishingRecoverer recoverer) {
        return config.batchFactory("melody-history-sink", true, 2000, recoverer);
    }
}

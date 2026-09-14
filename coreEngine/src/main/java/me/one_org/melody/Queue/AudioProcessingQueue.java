package me.one_org.melody.Queue;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

import me.one_org.melody.Dto.Queue.AudioProcessingQueueDto;

import lombok.extern.slf4j.Slf4j;
import java.util.Map;

@Slf4j
@Component
public class AudioProcessingQueue {
    private final RedisTemplate<String,Object> redisTemplate;

    @Value("${spring.data.redis.audioprocessingqueue}")
    private String audioProcessingQueue;

    @Value("${spring.data.redis.cancelqueue:audio_cancel_queue}")
    private String audioCancelQueue;

    public AudioProcessingQueue(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public void queueAudioProcessing(AudioProcessingQueueDto data){
        redisTemplate.opsForList().rightPush(audioProcessingQueue, data);
    }

    public void removeJobFromQueue(String jobId) {
        try {
            Long removed = redisTemplate.opsForList().remove(audioProcessingQueue, 0, new AudioProcessingQueueDto(jobId));
            log.info("Removed {} pending queue instances of job [{}] from Redis queue [{}]", removed, jobId, audioProcessingQueue);
        } catch (Exception e) {
            log.warn("Failed to remove job [{}] from Redis queue: {}", jobId, e.getMessage());
        }
    }

    public void cancelJob(String jobId) {
        try {
            Map<String, String> payload = Map.of("jobId", jobId);
            redisTemplate.opsForList().rightPush(audioCancelQueue, payload);
            log.info("Pushed cancellation event for job [{}] to Redis cancel queue [{}]", jobId, audioCancelQueue);
        } catch (Exception e) {
            log.warn("Failed to push cancellation event for job [{}] to Redis queue: {}", jobId, e.getMessage());
        }
    }
}

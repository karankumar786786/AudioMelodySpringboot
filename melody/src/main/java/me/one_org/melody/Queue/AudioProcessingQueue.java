package me.one_org.melody.Queue;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

import me.one_org.melody.Dto.AudioProcessingQueueDto;

@Component
public class AudioProcessingQueue {
    private final RedisTemplate<String,Object> redisTemplate;

    @Value("${spring.data.redis.audioprocessingqueue}")
    private String audioProcessingQueue;

    public AudioProcessingQueue(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public void queueAudioProcessing(AudioProcessingQueueDto data){
        redisTemplate.opsForList().rightPush(audioProcessingQueue, data);
    }
}

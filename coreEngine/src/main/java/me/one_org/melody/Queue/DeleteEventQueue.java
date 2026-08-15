package me.one_org.melody.Queue;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

import me.one_org.melody.Dto.Queue.DeleteEventQueueDto;

@Component
public class DeleteEventQueue {

    private final RedisTemplate<String, Object> redisTemplate;

    @Value("${spring.data.redis.deletequeue}")
    private String deleteQueue;

    public DeleteEventQueue(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public void queueDeleteEvent(DeleteEventQueueDto data) {
        redisTemplate.opsForList().rightPush(deleteQueue, data);
    }
}
package me.one_org.melody.Queue;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

import me.one_org.melody.Dto.MailQueueDto;

@Component
public class MailQueue {

    private final RedisTemplate<String,Object> redisTemplate;

    @Value("${spring.data.redis.mailqueue}")
    private String mailQueue;

    public MailQueue(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }
    
    public void queueMail(MailQueueDto data){
        redisTemplate.opsForList().rightPush(mailQueue, data);
    }
}

package me.one_org.melody.Queue;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

import me.one_org.melody.Dto.Queue.MailQueueDto;

/**
 * @deprecated Decommissioned on branch `alive`.
 * Transactional emails are dispatched directly in-process via {@link me.one_org.melody.Utils.MailUtil}.
 * Retained for backward-compatibility only.
 */
@Deprecated(since = "alive branch - mailEvents decommissioned")
@Component
public class MailQueue {

    private final RedisTemplate<String, Object> redisTemplate;

    @Value("${spring.data.redis.mailqueue:mail_queue}")
    private String mailQueue;

    public MailQueue(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }
    
    public void queueMail(MailQueueDto data) {
        if (mailQueue != null && data != null) {
            redisTemplate.opsForList().rightPush(mailQueue, data);
        }
    }
}

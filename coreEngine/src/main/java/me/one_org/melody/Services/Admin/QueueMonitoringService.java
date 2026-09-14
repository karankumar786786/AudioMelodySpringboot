package me.one_org.melody.Services.Admin;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Dto.Controllers.Admin.Queue.QueueBackpressureSummaryDto;
import me.one_org.melody.Dto.Controllers.Admin.Queue.QueueItemDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@Slf4j
public class QueueMonitoringService {

    private final RedisTemplate<String, Object> redisTemplate;

    @Value("${spring.data.redis.audioprocessingqueue:audio_processing_queue}")
    private String audioProcessingQueueKey;

    @Value("${spring.data.redis.mailqueue:mail_queue}")
    private String mailQueueKey;

    @Value("${spring.data.redis.deletequeue:delete_event_queue}")
    private String deleteQueueKey;

    public QueueMonitoringService(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public QueueBackpressureSummaryDto getQueueBackpressureSummary() {
        String mailDlqKey = (mailQueueKey != null ? mailQueueKey : "mail_queue") + "_dlq";

        long audioSize = getQueueSize(audioProcessingQueueKey);
        long mailSize = getQueueSize(mailQueueKey);
        long deleteSize = getQueueSize(deleteQueueKey);
        long mailDlqSize = getQueueSize(mailDlqKey);

        List<QueueItemDto> queues = new ArrayList<>();

        // 1. Audio Processing Queue
        queues.add(QueueItemDto.builder()
                .queueName("Audio Processing Queue")
                .queueKey(audioProcessingQueueKey)
                .size(audioSize)
                .backpressureStatus(evaluateStandardBackpressure(audioSize))
                .type("STANDARD")
                .description("Ingestion & transcoding jobs pending worker pickup")
                .safeThreshold(10L)
                .highThreshold(50L)
                .build());

        // 2. Mail Queue
        queues.add(QueueItemDto.builder()
                .queueName("Mail Dispatch Queue")
                .queueKey(mailQueueKey)
                .size(mailSize)
                .backpressureStatus(evaluateStandardBackpressure(mailSize))
                .type("STANDARD")
                .description("Pending verification codes, password resets & OTP emails")
                .safeThreshold(10L)
                .highThreshold(50L)
                .build());

        // 3. Delete Cascade Queue
        queues.add(QueueItemDto.builder()
                .queueName("Delete Cascade Queue")
                .queueKey(deleteQueueKey)
                .size(deleteSize)
                .backpressureStatus(evaluateStandardBackpressure(deleteSize))
                .type("STANDARD")
                .description("Cloud resource cleanup events (Algolia, Recombee, ImageKit, S3)")
                .safeThreshold(10L)
                .highThreshold(50L)
                .build());

        // 4. Mail Dead-Letter Queue (DLQ)
        queues.add(QueueItemDto.builder()
                .queueName("Mail Dead-Letter Queue")
                .queueKey(mailDlqKey)
                .size(mailDlqSize)
                .backpressureStatus(mailDlqSize > 0 ? "ALERT" : "HEALTHY")
                .type("DLQ")
                .description("Failed email jobs requiring inspection (SMTP rate-limit or bad recipient)")
                .safeThreshold(0L)
                .highThreshold(5L)
                .build());

        long totalQueued = audioSize + mailSize + deleteSize + mailDlqSize;

        String overallStatus;
        if (mailDlqSize > 0) {
            overallStatus = "DLQ_ALERT";
        } else if (audioSize >= 50 || mailSize >= 50 || deleteSize >= 50) {
            overallStatus = "HIGH";
        } else if (audioSize >= 10 || mailSize >= 10 || deleteSize >= 10) {
            overallStatus = "MODERATE";
        } else {
            overallStatus = "HEALTHY";
        }

        return QueueBackpressureSummaryDto.builder()
                .totalQueued(totalQueued)
                .overallStatus(overallStatus)
                .audioProcessingQueueSize(audioSize)
                .mailQueueSize(mailSize)
                .deleteQueueSize(deleteSize)
                .mailDlqSize(mailDlqSize)
                .queues(queues)
                .timestamp(LocalDateTime.now())
                .build();
    }

    private String evaluateStandardBackpressure(long size) {
        if (size >= 50) return "HIGH";
        if (size >= 10) return "ELEVATED";
        return "HEALTHY";
    }

    private long getQueueSize(String queueKey) {
        if (queueKey == null || queueKey.isBlank()) {
            return 0L;
        }
        try {
            Long size = redisTemplate.opsForList().size(queueKey);
            return size != null ? size : 0L;
        } catch (Exception e) {
            log.warn("Failed to query Redis queue size for key '{}': {}", queueKey, e.getMessage());
            return 0L;
        }
    }
}

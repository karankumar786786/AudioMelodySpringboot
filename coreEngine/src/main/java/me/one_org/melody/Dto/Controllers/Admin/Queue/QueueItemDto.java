package me.one_org.melody.Dto.Controllers.Admin.Queue;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class QueueItemDto {
    private String queueName;
    private String queueKey;
    private long size;
    private String backpressureStatus; // HEALTHY, ELEVATED, HIGH, ALERT
    private String type; // STANDARD, DLQ
    private String description;
    private long safeThreshold;
    private long highThreshold;
}

package me.one_org.melody.Dto.Controllers.Admin.Queue;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class QueueBackpressureSummaryDto {
    private long totalQueued;
    private String overallStatus; // HEALTHY, MODERATE, HIGH, DLQ_ALERT
    private long audioProcessingQueueSize;
    private long mailQueueSize;
    private long deleteQueueSize;
    private long mailDlqSize;
    private List<QueueItemDto> queues;
    private LocalDateTime timestamp;
}

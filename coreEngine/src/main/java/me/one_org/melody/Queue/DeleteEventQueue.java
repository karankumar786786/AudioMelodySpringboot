package me.one_org.melody.Queue;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

import me.one_org.melody.Dto.Queue.DeleteEventQueueDto;
import me.one_org.melody.Entity.DeleteJobsEntity;
import me.one_org.melody.Enums.DeleteJobStageEnum;
import me.one_org.melody.Enums.DeleteJobStatusEnum;
import me.one_org.melody.Repository.DeleteJobsRepository;

import java.time.LocalDateTime;
import java.util.UUID;

@Component
public class DeleteEventQueue {

    private final RedisTemplate<String, Object> redisTemplate;
    private final DeleteJobsRepository deleteJobsRepository;
    private final me.one_org.melody.Services.General.PaginationMetaDataService paginationMetaDataService;

    @Value("${spring.data.redis.deletequeue}")
    private String deleteQueue;

    public DeleteEventQueue(
            RedisTemplate<String, Object> redisTemplate,
            DeleteJobsRepository deleteJobsRepository,
            me.one_org.melody.Services.General.PaginationMetaDataService paginationMetaDataService) {
        this.redisTemplate = redisTemplate;
        this.deleteJobsRepository = deleteJobsRepository;
        this.paginationMetaDataService = paginationMetaDataService;
    }

    public String queueDeleteEvent(DeleteEventQueueDto data) {
        String jobId = data.deleteJobId() != null ? data.deleteJobId() : UUID.randomUUID().toString();

        DeleteJobsEntity job = deleteJobsRepository.findById(jobId).orElse(null);
        boolean isNew = (job == null);
        DeleteJobStatusEnum oldStatus = isNew ? null : job.getStatus();

        if (isNew) {
            job = DeleteJobsEntity.builder()
                    .id(jobId)
                    .entityType(data.entityType())
                    .entityId(data.entityId())
                    .entityTitle(data.entityTitle())
                    .songKey(data.songKey())
                    .imageKey(data.imageKey())
                    .coverImageKey(data.coverImageKey())
                    .videoKey(data.videoKey())
                    .fullVideoKey(data.fullVideoKey())
                    .status(DeleteJobStatusEnum.PENDING)
                    .currentStage(DeleteJobStageEnum.QUEUED)
                    .attemptCount(1)
                    .maxAttempts(3)
                    .createdAt(LocalDateTime.now())
                    .build();
        } else {
            job.setStatus(DeleteJobStatusEnum.PENDING);
            job.setCurrentStage(DeleteJobStageEnum.QUEUED);
            job.setAttemptCount(job.getAttemptCount() + 1);
            job.setFailureReason(null);
            job.setFailedAt(null);
        }
        deleteJobsRepository.save(job);

        if (isNew) {
            paginationMetaDataService.incrementDeleteJob();
        } else {
            paginationMetaDataService.transitionDeleteJob(oldStatus, DeleteJobStatusEnum.PENDING);
        }

        DeleteEventQueueDto payload = data.withDeleteJobId(jobId);
        redisTemplate.opsForList().rightPush(deleteQueue, payload);

        return jobId;
    }
}
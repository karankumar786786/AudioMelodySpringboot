package me.one_org.melody.Entity;

import jakarta.persistence.*;
import lombok.*;
import me.one_org.melody.Enums.JobStageEnum;
import me.one_org.melody.Enums.JobStatusEnum;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "jobs")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class JobsEntity {
    @Id
    private String id;
    @Column(nullable = false)
    private String title;
    @Column(nullable = false)
    private String artistName;
    private Integer duration;
    private String tempSongKey;
    private String tempVideoKey;
    private String songKey;
    private String fullVideoKey;
    @Column(nullable = false)
    private String imageKey;
    private String videoKey;
    private Integer clipStartSec;
    private Integer clipEndSec;
    private Integer previewStartTime;
    private Integer previewEndTime;
    private String language;
    private String genre;
    private String lrclibId;
    @Column(nullable = false)
    private String songId;
    private String transcodingId;
    private Integer transcodingAttempt;
    private Boolean transcoded;
    private Boolean savedInSearch;
    private Boolean savedInRecommendation;
    /** When true this job only re-packages a full video for an existing song (no new SongsEntity row is created). */
    @Column(nullable = false)
    @Builder.Default
    private Boolean isVideoReprocess = false;

    /** When true this job re-processes audio for an existing song (no new SongsEntity row is created). */
    @Column
    @Builder.Default
    private Boolean isAudioReprocess = false;
    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private JobStatusEnum status;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private JobStageEnum currentStage = JobStageEnum.QUEUED;

    private LocalDateTime transcodingStartedAt;
    private LocalDateTime transcodedAt;
    private LocalDateTime recommendationSavedAt;
    private LocalDateTime searchSavedAt;
    private LocalDateTime completedAt;
    private LocalDateTime failedAt;

    @Column(columnDefinition = "TEXT")
    private String failureReason;

    private Long transcodingDurationMs;
    private Long recommendationDurationMs;
    private Long searchDurationMs;
    private Long finalizeDurationMs;
    private Long totalDurationMs;

    @CreationTimestamp
    private LocalDateTime createdAt;
}

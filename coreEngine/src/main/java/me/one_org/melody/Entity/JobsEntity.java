package me.one_org.melody.Entity;

import jakarta.persistence.*;
import lombok.*;
import me.one_org.melody.Enums.JobStatusEnum;

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
    private String language;
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
    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private JobStatusEnum status;

}

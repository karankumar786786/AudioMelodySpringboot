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
    private String jobId;
    private String songId; // track id
    @Column(nullable = false)
    private String title;
    @Column(nullable = false)
    private String artistName;
    private Integer duration;
    @Column(nullable = false)
    private String tempSongKey;
    private String songKey;
    @Column(nullable = false)
    private String imageKey;
    private String language;
    private String transcodingId;
    private Integer transcodingAttempt;
    private String transcribingId;
    private Integer transcribingAttempt;
    private Boolean transcoded;
    private Boolean transcribed;
    private Boolean savedInSearch;
    private Boolean savedInRecommendation;
    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private JobStatusEnum status;
    @OneToOne(mappedBy = "job", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private SongsEntity song;
}


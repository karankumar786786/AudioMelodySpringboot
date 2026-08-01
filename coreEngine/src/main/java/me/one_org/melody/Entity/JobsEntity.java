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
    @com.fasterxml.jackson.annotation.JsonIgnore
    @OneToOne(mappedBy = "job", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private SongsEntity song;
}


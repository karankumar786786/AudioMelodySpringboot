package me.one_org.melody.Entity;

import jakarta.persistence.*;
import lombok.*;
import me.one_org.melody.Enums.JobStatus;

@Entity
@Table(name = "jobs")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class Jobs {

    @Id
    private String jobId;

    private String id; // track id

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

    private Integer sampleRate;

    private Double loudness;
    private Double dynamicComplexity;
    private Integer bpm;
    private Double spectralCentroid;
    private Double spectralFlux;
    private Double zeroCrossingRate;

    private String transcodingId;
    private Integer transcodingAttempt;

    private String transcribingId;
    private Integer transcribingAttempt;

    private Boolean transcoded;
    private Boolean transcribed;
    private Boolean extractedFeatures;
    private Boolean savedInSearch;
    private Boolean savedInRecommendation;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private JobStatus status;

    @OneToOne(mappedBy = "job", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private Songs song;
}


package me.one_org.melody.Entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.io.Serializable;
import java.time.LocalDateTime;

import lombok.Builder.Default;
import me.one_org.melody.Enums.StatusEnum;

@Entity
@Table(name = "songs")
@Builder
@Data
@AllArgsConstructor
@NoArgsConstructor
public class SongsEntity implements Serializable{

    @Id
    private String id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String artistName;

    @Column(nullable = false)
    private Integer duration;

    @Column(nullable = false)
    private String songKey;

    @Column(nullable = false)
    private String imageKey;

    @Column(nullable = false)
    private String language;

    @Column(nullable = false)
    private String lrclibId;

    @Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatusEnum status = StatusEnum.ACTIVE;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_id", nullable = false)
    private JobsEntity job;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
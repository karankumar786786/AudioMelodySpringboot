package me.one_org.melody.Entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
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

    private String videoKey;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isFeatured = false;

    public boolean isFeatured() {
        return Boolean.TRUE.equals(this.isFeatured);
    }

    public void setFeatured(Boolean isFeatured) {
        this.isFeatured = isFeatured != null ? isFeatured : false;
    }

    @Column(nullable = false)
    private String language;

    @Column(nullable = false)
    private String lrclibId;

    @Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatusEnum status = StatusEnum.ACTIVE;

    @Column(name = "job_id", nullable = false)
    private String jobId;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_id", insertable = false, updatable = false)
    @JsonIgnore
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private JobsEntity job;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
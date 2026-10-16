package me.one_org.melody.Entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;


import java.time.LocalDateTime;


import me.one_org.melody.Enums.StatusEnum;

@Entity
@Table(name = "songs")
@Data
public class Song{

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

    private String fullVideoKey;

    private Integer previewStartTime;

    private Integer previewEndTime;

    @Column(nullable = false)
    private Boolean isFeatured;

    @Column(nullable = false)
    private String language;


    @Column(nullable = false)
    private String genre;

    @Column(nullable = false)
    private String album;

    @Column(nullable = false)
    private String lrclibId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatusEnum status;

    @OneToOne(mappedBy = "song", fetch = FetchType.LAZY)
    private SongMetadata songMetadata;

    @CreationTimestamp
    private LocalDateTime createdAt;

    public Song() {
        super();
    }

    @Builder
    public Song(String id, String title, String artistName, Integer duration, String songKey, String imageKey,
                String videoKey, String fullVideoKey, Integer previewStartTime, Integer previewEndTime,
                Boolean isFeatured, String language, String genre, String album, String lrclibId,
                StatusEnum status, SongMetadata songMetadata, LocalDateTime createdAt) {
        super();
        this.id = id;
        this.title = title;
        this.artistName = artistName;
        this.duration = duration;
        this.songKey = songKey;
        this.imageKey = imageKey;
        this.videoKey = videoKey;
        this.fullVideoKey = fullVideoKey;
        this.previewStartTime = previewStartTime;
        this.previewEndTime = previewEndTime;
        this.isFeatured = isFeatured;
        this.language = language;
        this.genre = genre;
        this.album = album;
        this.lrclibId = lrclibId;
        this.status = status;
        this.songMetadata = songMetadata;
        this.createdAt = createdAt;
    }
}
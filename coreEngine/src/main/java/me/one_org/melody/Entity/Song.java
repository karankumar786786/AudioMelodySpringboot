package me.one_org.melody.Entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;


import java.time.LocalDateTime;


import me.one_org.melody.Enums.StatusEnum;

/**
 * Table: songs
 * Ek gaana: title, artist, duration (seconds), S3 keys (audio HLS, image, video),
 * preview ka start/end, genre, language, album, country, lyrics id aur audio features.
 * songKey = S3 me us folder ka naam jisme master.m3u8 (HLS playlist) hai.
 * Streams ka count alag table song_metadata (SongMetadata) me hai.
 *
 * Entity = Java class jo database ki ek table se juda hai; har object = table ki ek row.
 * Table Flyway migrations (migration/ module) banate hain, ye class sirf usko map karti hai.
 */
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
    private String country;

    @Column(nullable = false)
    private String lrclibId;

    @Column(name = "job_id")
    private String jobId;

    // Audio features (Flyway V15): media pipeline gaane ko analyse karke ye values deta hai.
    // Analyse hone tak null rehte hain. tempo = BPM (beats per minute);
    // energy, valence (khushi/udaasi), danceability = 0 se 1 ke beech.
    private Double tempo;

    private Double energy;

    private Double valence;

    private Double danceability;

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
                Boolean isFeatured, String language, String genre, String album, String country, String lrclibId, String jobId,
                StatusEnum status, SongMetadata songMetadata, LocalDateTime createdAt,
                Double tempo, Double energy, Double valence, Double danceability) {
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
        this.country = country != null ? country : "India"; // country na di ho to default India
        this.lrclibId = lrclibId;
        this.jobId = jobId;
        this.status = status;
        this.songMetadata = songMetadata;
        this.createdAt = createdAt;
        this.tempo = tempo;
        this.energy = energy;
        this.valence = valence;
        this.danceability = danceability;
    }
}
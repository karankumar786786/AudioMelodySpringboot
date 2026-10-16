package me.one_org.melody.Entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Builder;
import lombok.Data;

@Entity 
@Table(name = "song_metadata")
@BatchSize(size = 50)
@Data 
public class SongMetadata {
    @Id 
    private String id;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @OneToOne(optional = false,fetch = FetchType.LAZY)
    @JoinColumn(name = "song_id")
    private Song song;

    private Long totalStreams;

    @UpdateTimestamp 
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    public SongMetadata() {
        super();
    }

    @Builder
    public SongMetadata(String id, Song song, Long totalStreams, LocalDateTime updatedAt) {
        super();
        this.id = id;
        this.song = song;
        this.totalStreams = totalStreams;
        this.updatedAt = updatedAt;
    }
}

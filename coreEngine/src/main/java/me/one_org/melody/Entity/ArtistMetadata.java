package me.one_org.melody.Entity;

import jakarta.persistence.*;
import lombok.*;

import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "artist_metadata")
@BatchSize(size = 50)
@Data
public class ArtistMetadata {
    @Id
    @Column(name = "artist_id")
    private String id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "artist_id", insertable = false, updatable = false)
    private Artist artist;

    @Column(name = "artist_name")
    private String artistName;

    @Column(name = "followers_count", nullable = false)
    private Long followersCount;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public ArtistMetadata() {
        super();
    }

    @Builder
    public ArtistMetadata(String id, Artist artist, String artistName, Long followersCount, LocalDateTime createdAt, LocalDateTime updatedAt) {
        super();
        this.id = id;
        this.artist = artist;
        this.artistName = artistName;
        this.followersCount = followersCount;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }
}

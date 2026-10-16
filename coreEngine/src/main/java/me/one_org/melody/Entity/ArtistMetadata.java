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
    private String id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "artist_id")
    private Artist artist;

    @Column(nullable = false)
    private Long followersCount;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    public ArtistMetadata() {
        super();
    }

    @Builder
    public ArtistMetadata(String id, Artist artist, Long followersCount, LocalDateTime createdAt, LocalDateTime updatedAt) {
        super();
        this.id = id;
        this.artist = artist;
        this.followersCount = followersCount;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }
}

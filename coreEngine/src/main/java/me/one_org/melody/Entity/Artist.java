package me.one_org.melody.Entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

import me.one_org.melody.Enums.StatusEnum;

/**
 * Table: artists
 * Ek artist (singer/band): naam, bio, janam tareekh, cover image ki S3 key, status.
 * Followers ka count alag table artist_metadata (ArtistMetadata) me rakha hai.
 *
 * Entity = Java class jo database ki ek table se juda hai; har object = table ki ek row.
 * Table Flyway migrations (migration/ module) banate hain, ye class sirf usko map karti hai.
 */
@Entity
@Table(name = "artists")
@Data
public class Artist{

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String about;

    @Column(nullable = false)
    private LocalDateTime dob;

    @Column(nullable = false)
    private String coverImageKey;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatusEnum status;

    @OneToOne(mappedBy = "artist", fetch = FetchType.LAZY)
    private ArtistMetadata artistMetadata;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public Artist() {
        super();
    }

    @Builder
    public Artist(String id, String name, String about, LocalDateTime dob, String coverImageKey,
                  StatusEnum status, ArtistMetadata artistMetadata, LocalDateTime createdAt) {
        super();
        this.id = id;
        this.name = name;
        this.about = about;
        this.dob = dob;
        this.coverImageKey = coverImageKey;
        this.status = status;
        this.artistMetadata = artistMetadata;
        this.createdAt = createdAt;
    }
}


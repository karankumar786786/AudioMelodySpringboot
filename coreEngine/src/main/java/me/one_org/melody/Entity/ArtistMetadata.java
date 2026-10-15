package me.one_org.melody.Entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "artist_metadata")
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class ArtistMetadata {

    @Id
    private String id;

    @OneToOne 
    @JoinColumn(name = "artist_id")
    private Artist artist;

    @Column(name = "followers_count", nullable = false)
    private Long followersCount;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}

package me.one_org.melody.Entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.io.Serializable;
import java.time.LocalDateTime;

@Entity
@Table(name = "artist_metadata")
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class ArtistMetadataEntity implements Serializable {

    @Id
    @Column(name = "artist_id", nullable = false)
    private String artistId;

    @Column(name = "artist_name", nullable = false)
    private String artistName;

    @Builder.Default
    @Column(name = "followers_count", nullable = false)
    private Long followersCount = 0L;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}

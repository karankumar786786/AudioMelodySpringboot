package me.one_org.melody.Entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.io.Serializable;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "artist_follow_events",
    indexes = {
        @Index(name = "idx_follow_events_user_artist", columnList = "user_id, artist_id"),
        @Index(name = "idx_follow_events_artist", columnList = "artist_id")
    }
)
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class ArtistFollowEventEntity implements Serializable {

    @Id
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "artist_id", nullable = false)
    private String artistId;

    @Column(name = "event_type", nullable = false)
    private String eventType; // "FOLLOW" or "UNFOLLOW"

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}

package me.one_org.melody.Entity;

import jakarta.persistence.*;
import lombok.*;
import me.one_org.melody.Enums.FollowEvents;

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
public class ArtistFollowEvent implements Serializable {
    @Id
    private String id;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne
    @JoinColumn(name = "artist_id")
    private Artist artist;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false)
    private FollowEvents event;
     
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}

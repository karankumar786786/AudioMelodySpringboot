package me.one_org.melody.Entity;

import jakarta.persistence.*;
import lombok.*;
import me.one_org.melody.Enums.FollowEvents;

import org.hibernate.annotations.CreationTimestamp;


import java.time.LocalDateTime;

@Entity
@Table(name = "artist_follow_events") // we dont require here this things because it will be processed before saving
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class ArtistFollowEvent{
    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "artist_id")
    private Artist artist;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false)
    private FollowEvents event;
     
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}

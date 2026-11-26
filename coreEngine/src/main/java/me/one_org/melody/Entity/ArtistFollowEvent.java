package me.one_org.melody.Entity;

import jakarta.persistence.*;
import lombok.*;
import me.one_org.melody.Enums.FollowEvent;


import org.hibernate.annotations.CreationTimestamp;


import java.time.LocalDateTime;

/**
 * Table: artist_follow_events
 * Kisi user ne kisi artist ko FOLLOW ya UNFOLLOW kiya - har action ki ek row (history).
 * Naye song pe followers ko email bhejne ke liye isi table se followers nikalte hain.
 *
 * Entity = Java class jo database ki ek table se juda hai; har object = table ki ek row.
 * Table Flyway migrations (migration/ module) banate hain, ye class sirf usko map karti hai.
 */
@Entity
@Table(name = "artist_follow_events")
@Data
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
    private FollowEvent followEvent;
     
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public ArtistFollowEvent() {
        super();
    }

    @Builder
    public ArtistFollowEvent(String id, User user, Artist artist, FollowEvent followEvent, LocalDateTime createdAt) {
        super();
        this.id = id;
        this.user = user;
        this.artist = artist;
        this.followEvent = followEvent;
        this.createdAt = createdAt;
    }
}

package me.one_org.melody.Entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Builder;
import lombok.Data;

@Entity
@Table(
    name = "user_shorts_likes",
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_user_shorts_like", columnNames = {"user_id", "song_id"})
    },
    indexes = {
        @Index(name = "idx_shorts_like_user", columnList = "user_id"),
        @Index(name = "idx_shorts_like_song", columnList = "song_id")
    }
)
@Data
public class UserShortsLike {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "song_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Song song;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public UserShortsLike() {
        super();
    }

    @Builder
    public UserShortsLike(Long id, User user, Song song, LocalDateTime createdAt) {
        this.id = id;
        this.user = user;
        this.song = song;
        this.createdAt = createdAt;
    }

    public String getUserId() {
        return user != null ? user.getId() : null;
    }
}


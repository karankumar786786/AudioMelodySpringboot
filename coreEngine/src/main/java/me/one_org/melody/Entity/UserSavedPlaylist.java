package me.one_org.melody.Entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(
    name = "user_saved_playlists",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_user_saved_playlist",
        columnNames = { "user_id", "playlist_id" }
    ),
    indexes = @Index(name = "idx_saved_playlist_playlist", columnList = "playlist_id")
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserSavedPlaylist {

    @Id
    private String id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "playlist_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private UserPlaylist playlist;

    @CreationTimestamp
    @Column(name = "saved_at", nullable = false, updatable = false)
    private LocalDateTime savedAt;
}
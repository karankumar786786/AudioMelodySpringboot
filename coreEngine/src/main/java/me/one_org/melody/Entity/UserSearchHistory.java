package me.one_org.melody.Entity;

import jakarta.persistence.*;
import lombok.*;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_search_history")
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class UserSearchHistory {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @Column(name = "entity_type", nullable = false)
    private String entityType; // "SONG", "ARTIST", "PLAYLIST", "USER_PLAYLIST"

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "song_id")
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Song song;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "artist_id")
    @OnDelete(action = OnDeleteAction.CASCADE)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Artist artist;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "playlist_id")
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Playlist playlist;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_playlist_id")
    @OnDelete(action = OnDeleteAction.CASCADE)
    private UserPlaylist userPlaylist;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public String getTableName() {
        return this.entityType;
    }

    public void setTableName(String tableName) {
        this.entityType = tableName;
    }
}

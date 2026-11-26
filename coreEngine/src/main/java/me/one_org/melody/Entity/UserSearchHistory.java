package me.one_org.melody.Entity;

import jakarta.persistence.*;
import lombok.*;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import java.time.LocalDateTime;

/**
 * Table: user_search_history
 * User ne search karke kya khola (song / artist / playlist / user playlist) - recent searches ke liye.
 * entityType batata hai ki kaunsa column bhara hai.
 *
 * Entity = Java class jo database ki ek table se juda hai; har object = table ki ek row.
 * Table Flyway migrations (migration/ module) banate hain, ye class sirf usko map karti hai.
 */
@Entity
@Table(name = "user_search_history")
@Data
public class UserSearchHistory {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @Column(name = "entity_type", nullable = false)
    private String entityType; // "SONG", "ARTIST", "PLAYLIST" ya "USER_PLAYLIST" - inme se ek hi neeche wala column bhara hoga

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

    public UserSearchHistory() {
        super();
    }

    @Builder
    public UserSearchHistory(String id, User user, String entityType, Song song, Artist artist,
                             Playlist playlist, UserPlaylist userPlaylist, LocalDateTime createdAt) {
        super();
        this.id = id;
        this.user = user;
        this.entityType = entityType;
        this.song = song;
        this.artist = artist;
        this.playlist = playlist;
        this.userPlaylist = userPlaylist;
        this.createdAt = createdAt;
    }

    // Purane code ke liye entityType ka doosra naam.
    public String getTableName() {
        return this.entityType;
    }

    public void setTableName(String tableName) {
        this.entityType = tableName;
    }
}

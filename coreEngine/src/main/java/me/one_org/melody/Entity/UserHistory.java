package me.one_org.melody.Entity;


import jakarta.persistence.*;
import lombok.Builder;
import lombok.Data;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.LocalDateTime;

/**
 * Table: user_history
 * User ne kab kaunsa gaana suna - har play ki ek row.
 * part = gaane ka kitna percent suna (0-100). "Recently played" aur recommendations isi se bante hain.
 *
 * Entity = Java class jo database ki ek table se juda hai; har object = table ki ek row.
 * Table Flyway migrations (migration/ module) banate hain, ye class sirf usko map karti hai.
 */
@Entity
@Table(name = "user_history")
@Data 
public class UserHistory {

    @Id
    private String id;

    @ManyToOne(optional = false,fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "song_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Song song;

    @Column(nullable = false)
    private Integer part;

    @CreationTimestamp
    @Column(nullable = false)
    private LocalDateTime listenedAt;

    public UserHistory() {
        super();
    }

    @Builder
    public UserHistory(String id, User user, Song song, Integer part, LocalDateTime listenedAt) {
        super();
        this.id = id;
        this.user = user;
        this.song = song;
        this.part = part;
        this.listenedAt = listenedAt;
    }
}

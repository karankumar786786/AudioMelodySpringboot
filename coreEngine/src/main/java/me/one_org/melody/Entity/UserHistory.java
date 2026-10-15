package me.one_org.melody.Entity;


import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_history")
@Data 
@AllArgsConstructor 
@NoArgsConstructor 
@Builder 
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
}

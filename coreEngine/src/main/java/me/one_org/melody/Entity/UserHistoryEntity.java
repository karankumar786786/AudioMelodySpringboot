package me.one_org.melody.Entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_history")
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class UserHistoryEntity {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UsersEntity user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "song_id", nullable = false)
    private SongsEntity song;

    @Column(nullable = false)
    private Integer part;

    @CreationTimestamp
    private LocalDateTime listenedAt;
}

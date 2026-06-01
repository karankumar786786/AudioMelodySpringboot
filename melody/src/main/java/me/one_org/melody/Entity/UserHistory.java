package me.one_org.melody.Entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_history")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class UserHistory {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private Users user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "song_id", nullable = false)
    private Songs song;

    @Column(nullable = false)
    private Integer part;

    @CreationTimestamp
    private LocalDateTime listenedAt;
}

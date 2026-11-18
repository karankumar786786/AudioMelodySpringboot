package me.one_org.melody.Entity;

import jakarta.persistence.*;
import lombok.Builder;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * P6: Stores user genre preferences selected during cold-start onboarding.
 * Table is created by the Flyway migration V14__add_user_genre_preferences.sql in the migration module.
 */
@Entity
@Table(name = "user_genre_preferences")
@Data
public class UserGenrePreference {

    @Id
    private String id;

    @OneToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    /** Comma-separated genre names, e.g. "Pop,Hip-Hop,Rock" */
    @Column(name = "genres", nullable = false, columnDefinition = "TEXT")
    private String genres;

    @CreationTimestamp
    @Column(nullable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    public UserGenrePreference() {
        super();
    }

    @Builder
    public UserGenrePreference(String id, User user, String genres,
                                LocalDateTime createdAt, LocalDateTime updatedAt) {
        super();
        this.id = id;
        this.user = user;
        this.genres = genres;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }
}


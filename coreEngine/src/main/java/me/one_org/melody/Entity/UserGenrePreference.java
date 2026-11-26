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
 * Table: user_genre_preferences
 * Naye user ne onboarding me jo genres chune (jaise Pop, Rock) - har user ki ek row.
 * Shuru me user ki koi history nahi hoti ("cold start"), tab recommendations inhi genres se bante hain.
 * Table Flyway migration V14 banata hai.
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

    /** Comma se alag genre naam, jaise "Pop,Hip-Hop,Rock" */
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


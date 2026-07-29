package me.one_org.melody.Entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import lombok.*;
import lombok.Builder.Default;
import org.hibernate.annotations.CreationTimestamp;
import me.one_org.melody.Enums.Role;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

@Entity
@Table(name = "users")
@Data
@AllArgsConstructor
@Builder
public class Users {

    @Id
    private String id;

    private String userName;

    @Column(nullable = false, unique = true)
    @Email
    private String email;

    @Default
    @Enumerated(EnumType.STRING)
    private Role role = Role.USER;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "user_favourite_songs",
        joinColumns = @JoinColumn(name = "user_id"),
        inverseJoinColumns = @JoinColumn(name = "song_id")
    )
    private Set<Songs> favouriteSongs;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<UserPlaylists> playlists;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<UserHistory> listeningHistory;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<UserSearchHistory> searchHistory;
}
package me.one_org.melody.Entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "user_playlists")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class UserPlaylists {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private Users user;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "user_playlist_songs",
        joinColumns = @JoinColumn(name = "user_playlist_id"),
        inverseJoinColumns = @JoinColumn(name = "song_id")
    )
    private java.util.Set<Songs> songs;
}


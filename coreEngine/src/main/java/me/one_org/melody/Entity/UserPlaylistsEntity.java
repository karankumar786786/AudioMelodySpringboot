package me.one_org.melody.Entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "user_playlists")
@Data
@AllArgsConstructor
@Builder
public class UserPlaylistsEntity {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UsersEntity user;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "user_playlist_songs",
        joinColumns = @JoinColumn(name = "user_playlist_id"),
        inverseJoinColumns = @JoinColumn(name = "song_id")
    )
    private java.util.Set<SongsEntity> songs;
}


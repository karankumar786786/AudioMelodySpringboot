package me.one_org.melody.Entity;

import java.util.Set;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import lombok.Builder.Default;
import me.one_org.melody.Enums.StatusEnum;

@Entity
@Table(name = "user_playlists")
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class UserPlaylistsEntity {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    @Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatusEnum status = StatusEnum.ACTIVE;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @JsonIgnore
    private UsersEntity user;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "user_playlist_songs",
        joinColumns = @JoinColumn(name = "user_playlist_id"),
        inverseJoinColumns = @JoinColumn(name = "song_id")
    )
    private Set<SongsEntity> songs;
}


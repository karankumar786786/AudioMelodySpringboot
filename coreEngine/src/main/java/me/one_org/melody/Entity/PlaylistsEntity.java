package me.one_org.melody.Entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.Set;

@Entity
@Table(name = "playlists")
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class PlaylistsEntity implements Serializable{

    @Id
    private String id;
    @Column(nullable = false)
    private String name;
    private String description;
    @Column(nullable = false)
    private String coverImageKey;
    @Column(nullable = false)
    private String bannerImageKey;
    @CreationTimestamp
    private LocalDateTime createdAt;
    @UpdateTimestamp
    private LocalDateTime updatedAt;
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "playlist_songs",
        joinColumns = @JoinColumn(name = "playlist_id"),
        inverseJoinColumns = @JoinColumn(name = "song_id")
    )
    private Set<SongsEntity> songs;
}


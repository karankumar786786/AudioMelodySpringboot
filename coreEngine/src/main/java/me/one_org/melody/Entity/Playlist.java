package me.one_org.melody.Entity;


import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;



import java.time.LocalDateTime;
import java.util.List;

import me.one_org.melody.Enums.StatusEnum;

@Entity
@Table(name = "playlists")
@Data 
@AllArgsConstructor 
@NoArgsConstructor 
public class Playlist{

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String description;

    @Column(nullable = false)
    private String coverImageKey;

    private String videoKey;

    @Column(name = "total_songs", nullable = false)
    private int totalSongs;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatusEnum status;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "playlist_songs",
        joinColumns = @JoinColumn(name="playlist_id"),
        inverseJoinColumns = @JoinColumn(name="song_id")
    )
    private List<Song> songs;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}


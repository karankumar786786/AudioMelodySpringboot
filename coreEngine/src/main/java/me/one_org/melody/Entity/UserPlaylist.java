package me.one_org.melody.Entity;

import java.util.List;

import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import me.one_org.melody.Enums.PlaylistPrivacyEnum;


@Entity
@Table(name = "user_playlists")
@Data 
@AllArgsConstructor 
@NoArgsConstructor 
@Builder 
public class UserPlaylist{

    @Id
    private String id;

    @Column(nullable = false)
    private String name;


    @Enumerated(EnumType.STRING)
    @Column(nullable = true)
    private PlaylistPrivacyEnum privacy;

    private String shareToken;


    @Column(nullable = false)
    private int totalSongs;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "user_playlist_songs",
        joinColumns = @JoinColumn(name = "user_playlist_id"),
        inverseJoinColumns = @JoinColumn(name = "song_id"),
        foreignKey = @ForeignKey(foreignKeyDefinition = "FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE")
    )
    private List<Song> songs;
    
}


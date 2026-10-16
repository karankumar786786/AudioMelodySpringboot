package me.one_org.melody.Entity;

import java.util.List;

import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import jakarta.persistence.*;
import lombok.Builder;
import lombok.Data;
import me.one_org.melody.Enums.PlaylistPrivacyEnum;


@Entity
@Table(name = "user_playlists")
@Data 
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

    public UserPlaylist() {
        super();
    }

    @Builder
    public UserPlaylist(String id, String name, PlaylistPrivacyEnum privacy, String shareToken,
                        int totalSongs, User user, List<Song> songs) {
        super();
        this.id = id;
        this.name = name;
        this.privacy = privacy;
        this.shareToken = shareToken;
        this.totalSongs = totalSongs;
        this.user = user;
        this.songs = songs;
    }
}


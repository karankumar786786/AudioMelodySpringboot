package me.one_org.melody.Entity;

import java.util.Set;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;
import lombok.Builder.Default;
import me.one_org.melody.Enums.PlaylistPrivacyEnum;
import me.one_org.melody.Enums.StatusEnum;

import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

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

    @Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PlaylistPrivacyEnum privacy = PlaylistPrivacyEnum.PRIVATE;

    @Column(name = "share_token", unique = true)
    private String shareToken;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    @JsonIgnore
    private UsersEntity user;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "user_playlist_songs",
        joinColumns = @JoinColumn(name = "user_playlist_id"),
        inverseJoinColumns = @JoinColumn(name = "song_id")
    )
    @OnDelete(action = OnDeleteAction.CASCADE)
    @JsonIgnore
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Set<SongsEntity> songs;

    @JsonProperty("ownerName")
    public String getOwnerName() {
        if (user != null) {
            return user.getUserName() != null && !user.getUserName().isBlank() ? user.getUserName() : user.getEmail();
        }
        return null;
    }

    @JsonProperty("ownerId")
    public String getOwnerId() {
        return user != null ? user.getId() : null;
    }
}


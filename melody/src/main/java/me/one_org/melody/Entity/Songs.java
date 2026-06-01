package me.one_org.melody.Entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.Set;

@Entity
@Table(name = "songs")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class Songs implements Serializable{

    @Id
    private String id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String artistName;

    @Column(nullable = false)
    private Integer duration;

    @Column(nullable = false)
    private String songKey;

    @Column(nullable = false)
    private String imageKey;

    @Column(nullable = false)
    private String language;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_id", nullable = false)
    private Jobs jobId;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @ManyToMany(mappedBy = "favouriteSongs", fetch = FetchType.LAZY)
    private Set<Users> favouritedBy;

    @ManyToMany(mappedBy = "songs", fetch = FetchType.LAZY)
    private Set<Playlists> playlists;

    @ManyToMany(mappedBy = "songs", fetch = FetchType.LAZY)
    private Set<UserPlaylists> userPlaylists;
}